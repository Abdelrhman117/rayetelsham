"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/dashboard",   label: "لوحة التحكم",       icon: "📊" },
  { href: "/inventory",   label: "المخزون",             icon: "📦" },
  { href: "/purchases",   label: "المشتريات والموردون", icon: "🛒" },
  { href: "/daily-sales", label: "مبيعات يومية",        icon: "🏪" },
  { href: "/expenses",    label: "المصروفات",           icon: "💸" },
  { href: "/salaries",    label: "الرواتب",             icon: "👷" },
  { href: "/reports",     label: "التقارير",            icon: "📈" },
  { href: "/invoices",    label: "الفواتير",            icon: "🧾" },
  { href: "/settings",    label: "الإعدادات",           icon: "⚙️" },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  const displayName =
    user?.email === "admin@gazal.com" ? "غزال" :
    user?.email === "admin@ahmed.com" ? "أحمد" :
    user?.email ?? "";

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white transition-colors">

      {/* Header */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-black/30">
            <span className="text-3xl">🥙</span>
          </div>
          <h1 className="text-lg font-bold tracking-wide">راية الشام</h1>
          <p className="text-xs text-amber-300/60 dark:text-slate-500 mt-0.5">نظام إدارة المطعم</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-xs text-amber-100 dark:text-slate-300">{displayName}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-amber-100/70 dark:text-slate-400 hover:bg-white/8 hover:text-white dark:hover:text-white"
              )}
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {active && (
                <span className="w-1.5 h-5 rounded-full bg-amber-300 dark:bg-amber-400 shrink-0"></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-xs text-amber-300/50 dark:text-slate-500">المظهر</span>
          <DarkModeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-100/60 dark:text-slate-400 hover:bg-red-500/15 hover:text-red-300 transition-all duration-150"
        >
          <span className="w-5 text-center">🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
