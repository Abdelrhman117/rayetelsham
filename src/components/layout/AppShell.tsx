"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LogoProvider, useLogoUrl } from "@/contexts/LogoContext";
import Sidebar from "./Sidebar";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { Toaster } from "sonner";
import { Menu, ChefHat, XCircle } from "lucide-react";

function AppLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const logoUrl = useLogoUrl();
  const dims = size === "sm" ? "w-7 h-7" : "w-16 h-16";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-8 h-8";
  if (logoUrl) {
    return <img src={logoUrl} className={`${dims} object-contain rounded-xl`} alt="logo" />;
  }
  return (
    <div className={`${dims} rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg`}>
      <ChefHat className={`${iconSize} text-white`} />
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const logoUrl = useLogoUrl();
  const { user, loading, isAdmin, isCashier } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <AppLogo size="md" />
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.push("/login");
    return null;
  }

  if (!isAdmin) {
    // Cashier accounts belong in /cashier, not the admin shell
    if (isCashier) {
      router.replace("/cashier");
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">غير مصرح بالدخول</h2>
          <p className="text-slate-400 text-sm mb-6">
            هذا الحساب ({user.email}) ليس لديه صلاحية الوصول لهذا النظام.
          </p>
          <button
            onClick={async () => { await signOut(auth); router.push("/login"); }}
            className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-60 flex-shrink-0">
        <div className="w-full">
          <Sidebar logoUrl={logoUrl} />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-60 z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} logoUrl={logoUrl} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-950 text-white border-b border-white/8">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <AppLogo size="sm" />
            <span className="font-bold text-sm">راية الشام</span>
          </div>
          <DarkModeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <Toaster position="top-center" richColors dir="rtl" theme="system" />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LogoProvider>
      <AppShellInner>{children}</AppShellInner>
    </LogoProvider>
  );
}
