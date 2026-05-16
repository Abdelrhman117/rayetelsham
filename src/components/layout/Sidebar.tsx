"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Package, ShoppingCart, Store,
  Wallet, Users, BarChart3, FileText, Settings, LogOut,
  ChefHat, UtensilsCrossed,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",   label: "لوحة التحكم",       icon: LayoutDashboard },
  { href: "/inventory",   label: "المخزون",             icon: Package },
  { href: "/purchases",   label: "المشتريات والموردون", icon: ShoppingCart },
  { href: "/daily-sales", label: "مبيعات يومية",        icon: Store },
  { href: "/expenses",    label: "المصروفات",           icon: Wallet },
  { href: "/salaries",    label: "الرواتب",             icon: Users },
  { href: "/reports",     label: "التقارير",            icon: BarChart3 },
  { href: "/invoices",    label: "الفواتير",            icon: FileText },
  { href: "/admin/menu",  label: "قائمة الطعام",        icon: UtensilsCrossed },
  { href: "/settings",    label: "الإعدادات",           icon: Settings },
];

export default function Sidebar({ onClose, logoUrl }: { onClose?: () => void; logoUrl?: string | null }) {
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
    <div className="flex flex-col h-full bg-slate-950 text-white">
      {/* Header */}
      <div className="px-5 py-6 border-b border-white/8">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} className="w-10 h-10 object-contain rounded-xl shrink-0" alt="logo" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shrink-0">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">راية الشام</h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate">نظام إدارة المطعم</p>
          </div>
        </div>
        {/* User badge */}
        <div className="mt-4 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <span className="text-yellow-400 text-xs font-bold">{displayName.slice(0, 1)}</span>
          </div>
          <span className="text-xs text-slate-300 font-medium truncate">{displayName}</span>
          <div className="mr-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0 transition-colors", active ? "text-yellow-400" : "text-slate-500 group-hover:text-slate-300")} />
              <span className="flex-1">{item.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"></span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-white/8 space-y-1">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl">
          <span className="text-xs text-slate-500">المظهر</span>
          <DarkModeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
