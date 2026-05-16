"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isCashier, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (!isCashier && !isAdmin) router.replace("/dashboard");
    }
  }, [user, loading, isCashier, isAdmin, router]);

  if (loading || !user) return null;

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-950">
        {children}
      </div>
    </ThemeProvider>
  );
}
