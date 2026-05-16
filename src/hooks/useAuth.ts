"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const ADMIN_EMAILS = ["admin@gazal.com", "admin@ahmed.com"];
export const CASHIER_EMAIL = "cashier@gazal.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isCashierEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === CASHIER_EMAIL;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCashier, setIsCashier] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(isAdminEmail(u?.email));
      setIsCashier(isCashierEmail(u?.email));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading, isAdmin, isCashier };
}
