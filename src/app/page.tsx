"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isCashierEmail } from "@/hooks/useAuth";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChefHat } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getDoc(doc(db, "appSettings", "branding")).then((snap) => {
      if (snap.exists()) setLogoUrl(snap.data().logoDataUrl || null);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (isCashierEmail(user.email)) {
        router.replace("/cashier");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 shadow-xl shadow-amber-900/40">
          {logoUrl
            ? <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
            : <ChefHat className="w-8 h-8 text-white" />
          }
        </div>
        <p className="text-white font-semibold text-lg">راية الشام</p>
        <div className="flex items-center gap-1.5 justify-center mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
