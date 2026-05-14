"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="text-center">
        <div className="text-5xl mb-4">🥙</div>
        <p className="text-amber-800 font-medium text-lg">راية الشام</p>
        <p className="text-amber-600 text-sm mt-1">جاري التحميل...</p>
      </div>
    </div>
  );
}
