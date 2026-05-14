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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
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
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="text-4xl">🥙</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-900 via-amber-800 to-amber-700 px-4">
      <Toaster position="top-center" richColors dir="rtl" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🥙</div>
          <h1 className="text-3xl font-bold text-white">رايا الشام</h1>
          <p className="text-amber-200 mt-1">نظام إدارة المطعم</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">تسجيل الدخول</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rayaalsham.com"
              required
              autoComplete="email"
            />
            <Input
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              دخول
            </Button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">
            للمسؤول فقط — لا يوجد تسجيل عام
          </p>
        </div>
      </div>
    </div>
  );
}
