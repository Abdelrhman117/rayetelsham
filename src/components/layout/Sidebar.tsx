"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import DarkModeToggle from "@/components/ui/DarkModeToggle";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "📊" },
  { href: "/inventory", label: "المخزون", icon: "📦" },
  { href: "/purchases", label: "المشتريات والموردون", icon: "🛒" },
  { href: "/sales", label: "المبيعات والعملاء", icon: "💼" },
  { href: "/daily-sales", label: "مبيعات يومية", icon: "🏪" },
  { href: "/expenses", label: "المصروفات", icon: "💸" },
  { href: "/salaries", label: "الرواتب", icon: "👷" },
  { href: "/reports", label: "التقارير", icon: "📈" },
  { href: "/invoices", label: "الفواتير", icon: "🧾" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <div className="flex flex-col h-full bg-amber-900 dark:bg-slate-900 text-white transition-colors">
      <div className="p-4 border-b border-amber-700 dark:border-slate-700">
        <div className="text-center">
          <div className="text-2xl mb-1">🥙</div>
          <h1 className="text-lg font-bold">راية الشام</h1>
          <p className="text-xs text-amber-300 dark:text-slate-400">نظام إدارة المطعم</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-amber-700 dark:bg-amber-800 text-white"
                : "text-amber-100 dark:text-slate-300 hover:bg-amber-800 dark:hover:bg-slate-800"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-amber-700 dark:border-slate-700 space-y-1">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-amber-300 dark:text-slate-400">المظهر</span>
          <DarkModeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-amber-100 dark:text-slate-300 hover:bg-amber-800 dark:hover:bg-slate-800 transition-colors"
        >
          <span>🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
