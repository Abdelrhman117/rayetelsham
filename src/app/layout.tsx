import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "رايا الشام - نظام إدارة المطعم",
  description: "نظام متكامل لإدارة مطعم رايا الشام - المخزون، المبيعات، المشتريات، الرواتب",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  );
}
