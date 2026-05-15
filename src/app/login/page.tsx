"use client";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Toaster } from "sonner";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChefHat, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch {
      toast.error("بيانات الدخول غير صحيحة. يرجى المحاولة مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-amber-900 via-amber-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #fbbf24 0%, transparent 60%), radial-gradient(circle at 80% 20%, #f59e0b 0%, transparent 50%)" }} />
        <div className="relative text-center text-white px-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <ChefHat className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold mb-3">راية الشام</h1>
          <p className="text-amber-200/80 text-lg">نظام إدارة المطعم المتكامل</p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-amber-100/60">
            {["إدارة المخزون", "تتبع المصروفات", "تقارير شهرية", "إدارة الموردين"].map(f => (
              <div key={f} className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center px-6 py-12 bg-slate-950">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">راية الشام</h1>
            <p className="text-slate-500 mt-1 text-sm">نظام إدارة المطعم</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">مرحباً بك</h2>
            <p className="text-slate-400 mt-1 text-sm">أدخل بيانات الدخول للمتابعة</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none mt-3" />
              <Input
                label="البريد الإلكتروني"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@rayaalsham.com"
                required
                autoComplete="email"
                className="pr-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-yellow-500"
              />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none mt-3" />
              <Input
                label="كلمة المرور"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="pr-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-yellow-500"
              />
            </div>
            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              تسجيل الدخول
            </Button>
          </form>
          <p className="text-center text-xs text-slate-600 mt-6">
            للمسؤول فقط — لا يوجد تسجيل عام
          </p>
        </div>
      </div>
      <Toaster position="top-center" richColors dir="rtl" />
    </div>
  );
}
