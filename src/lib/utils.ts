import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SY", {
    style: "currency",
    currency: "SYP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar").format(n);
}

export function formatDate(date: Timestamp | Date | string): string {
  let d: Date;
  if (date instanceof Timestamp) d = date.toDate();
  else if (date instanceof Date) d = date;
  else d = new Date(date);
  return format(d, "dd/MM/yyyy", { locale: ar });
}

export function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function monthString(date?: Date): string {
  return format(date || new Date(), "yyyy-MM");
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const EXPENSE_CATEGORIES = [
  "إيجار",
  "كهرباء",
  "ماء",
  "غاز",
  "إنترنت",
  "صيانة",
  "مستلزمات نظافة",
  "مواصلات",
  "رسوم حكومية",
  "تسويق",
  "أخرى",
];

export const UNITS = ["كغ", "لتر", "قطعة", "صندوق", "كيس", "علبة", "غرام", "مل", "طرد"];

export const PAYMENT_METHODS = ["نقد", "بطاقة", "محفظة"];
