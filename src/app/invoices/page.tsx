"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { getSupplierInvoices, getSalesInvoices } from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { SupplierInvoice, SalesInvoice } from "@/types";
import { Timestamp } from "firebase/firestore";

type AnyInvoice = (SupplierInvoice & { invoiceType: "supplier" }) | (SalesInvoice & { invoiceType: "customer" });

function tsToString(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date();
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function buildInvoiceHTML(invoice: AnyInvoice): string {
  const isSupplier = invoice.invoiceType === "supplier";
  const party = isSupplier
    ? `المورد: ${(invoice as SupplierInvoice).supplierName}`
    : `العميل: ${(invoice as SalesInvoice).customerName}`;

  const rows = invoice.items
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.unit}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unitPrice)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join("");

  const date = tsToString(invoice.date as unknown as Timestamp);
  const dueDate = tsToString(invoice.dueDate as unknown as Timestamp);
  const statusLabel = invoice.status === "paid" ? "مدفوع" : invoice.status === "partial" ? "جزئي" : "غير مدفوع";
  const warehouse = isSupplier
    ? `<p>المخزن: ${(invoice as SupplierInvoice).receivingWarehouse === "main" ? "المخزن الرئيسي" : "المحل"}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة ${invoice.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; direction: rtl; }
  h1 { color: #92400e; margin: 0; font-size: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #92400e; padding-bottom: 20px; }
  .company p { margin: 2px 0; font-size: 13px; color: #666; }
  .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
  .info-box { background: #fef3c7; border-radius: 8px; padding: 15px; }
  .info-box h3 { margin: 0 0 10px; font-size: 14px; color: #92400e; }
  .info-box p { margin: 3px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #92400e; color: white; padding: 10px 12px; text-align: right; font-size: 13px; }
  td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  tr:nth-child(even) td { background: #fafaf9; }
  .total-row td { background: #fef3c7 !important; font-weight: bold; font-size: 15px; border-top: 2px solid #92400e; }
  .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-unpaid { background: #fee2e2; color: #991b1b; }
  .status-partial { background: #fef3c7; color: #92400e; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <h1>🥙 راية الشام</h1>
    <p>مطعم الشاورما السوري الأصيل</p>
  </div>
  <div style="text-align:left">
    <p style="font-size:18px; font-weight:bold; color:#92400e;">${isSupplier ? "فاتورة شراء" : "فاتورة بيع"}</p>
    <p style="font-size:14px; color:#666;">رقم: ${invoice.invoiceNumber}</p>
    <p style="font-size:13px; color:#666;">التاريخ: ${date}</p>
  </div>
</div>

<div class="invoice-info">
  <div class="info-box">
    <h3>${isSupplier ? "معلومات المورد" : "معلومات العميل"}</h3>
    <p>${party}</p>
  </div>
  <div class="info-box">
    <h3>تفاصيل الفاتورة</h3>
    <p>تاريخ الاستحقاق: ${dueDate}</p>
    <p>الحالة: <span class="status status-${invoice.status}">${statusLabel}</span></p>
    ${warehouse}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="4">المجموع الكلي</td>
      <td>${formatCurrency(invoice.totalAmount)}</td>
    </tr>
    <tr style="background:#f9fafb">
      <td colspan="4">المدفوع</td>
      <td style="color:#059669">${formatCurrency(invoice.paidAmount)}</td>
    </tr>
    <tr style="background:#f9fafb">
      <td colspan="4" style="font-weight:bold">المتبقي</td>
      <td style="font-weight:bold;color:#dc2626">${formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
    </tr>
  </tbody>
</table>

${invoice.note ? `<div style="margin-top:20px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#666;"><strong>ملاحظة:</strong> ${invoice.note}</div>` : ""}

<div class="footer">
  <p>شكراً لتعاملكم مع راية الشام 🥙</p>
  <p>تم إنشاء هذه الفاتورة إلكترونياً — ${new Date().toLocaleDateString("ar-EG")}</p>
</div>
</body>
</html>`;
}

function openInvoice(invoice: AnyInvoice) {
  const html = buildInvoiceHTML(invoice);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<AnyInvoice[]>([]);
  const [tab, setTab] = useState<"all" | "supplier" | "customer">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { loadInvoices(); }, []);

  async function loadInvoices() {
    const [supInvs, salInvs] = await Promise.all([getSupplierInvoices(), getSalesInvoices()]);
    const combined: AnyInvoice[] = [
      ...(supInvs as SupplierInvoice[]).map((i) => ({ ...i, invoiceType: "supplier" as const })),
      ...(salInvs as SalesInvoice[]).map((i) => ({ ...i, invoiceType: "customer" as const })),
    ].sort((a, b) => {
      const toMs = (d: unknown) =>
        d instanceof Timestamp ? d.toDate().getTime() : new Date(d as string).getTime();
      return toMs(b.date) - toMs(a.date);
    });
    setInvoices(combined);
  }

  const filtered = invoices.filter((inv) => {
    const matchTab =
      tab === "all" ||
      (tab === "supplier" && inv.invoiceType === "supplier") ||
      (tab === "customer" && inv.invoiceType === "customer");
    const party = inv.invoiceType === "supplier"
      ? (inv as SupplierInvoice).supplierName
      : (inv as SalesInvoice).customerName;
    const matchSearch =
      !search ||
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      party.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">الفواتير</h1>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 w-full sm:w-auto">
            {[
              { key: "all", label: "الكل" },
              { key: "supplier", label: "فواتير شراء" },
              { key: "customer", label: "فواتير بيع" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? "border-amber-700 text-amber-700 dark:text-amber-400 dark:border-amber-400"
                    : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-full sm:w-64 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            placeholder="بحث برقم الفاتورة أو الطرف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card title={`الفواتير (${filtered.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                  <th className="pb-2 font-medium text-right">النوع</th>
                  <th className="pb-2 font-medium text-right">رقم الفاتورة</th>
                  <th className="pb-2 font-medium text-right">الطرف</th>
                  <th className="pb-2 font-medium text-right">التاريخ</th>
                  <th className="pb-2 font-medium text-right">المبلغ</th>
                  <th className="pb-2 font-medium text-right">المدفوع</th>
                  <th className="pb-2 font-medium text-right">الحالة</th>
                  <th className="pb-2 font-medium text-right">الفاتورة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const party =
                    inv.invoiceType === "supplier"
                      ? (inv as SupplierInvoice).supplierName
                      : (inv as SalesInvoice).customerName;
                  return (
                    <tr
                      key={`${inv.invoiceType}-${inv.id}`}
                      className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.invoiceType === "supplier"
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        }`}>
                          {inv.invoiceType === "supplier" ? "شراء" : "بيع"}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-gray-700 dark:text-slate-300">{inv.invoiceNumber}</td>
                      <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{party}</td>
                      <td className="py-2 text-gray-500 dark:text-slate-400">{formatDate(inv.date)}</td>
                      <td className="py-2 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-2 text-green-600 dark:text-green-400">{formatCurrency(inv.paidAmount)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2">
                        <button
                          onClick={() => openInvoice(inv)}
                          className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 px-2 py-1 rounded-md transition-colors"
                        >
                          عرض / طباعة
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 dark:text-slate-500 py-8">
                      لا توجد فواتير
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
