"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const LogoContext = createContext<string | null>(null);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getDoc(doc(db, "appSettings", "branding")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setLogoUrl(d.logoUrl || d.logoDataUrl || null);
      }
    });
  }, []);

  return <LogoContext.Provider value={logoUrl}>{children}</LogoContext.Provider>;
}

export function useLogoUrl() {
  return useContext(LogoContext);
}
