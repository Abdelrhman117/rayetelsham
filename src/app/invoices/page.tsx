"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { getSupplierInvoices } from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { SupplierInvoice } from "@/types";
import { Timestamp } from "firebase/firestore";

function tsToString(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date();
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function buildInvoiceHTML(invoice: SupplierInvoice): string {
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

  const date    = tsToString(invoice.date as unknown as Timestamp);
  const dueDate = tsToString(invoice.dueDate as unknown as Timestamp);
  const statusLabel =
    invoice.status === "paid" ? "مدفوع" :
    invoice.status === "partial" ? "جزئي" : "غير مدفوع";
  const warehouse = invoice.receivingWarehouse === "main" ? "المخزن الرئيسي" : "المحل";

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
  .status-paid { background: #d1fae5; color: #065f46; display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  .status-unpaid { background: #fee2e2; color: #991b1b; display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  .status-partial { background: #fef3c7; color: #92400e; display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <h1>🥙 راية الشام</h1>
    <p>مطعم الشاورما السوري الأصيل</p>
  </div>
  <div style="text-align:left">
    <p style="font-size:18px;font-weight:bold;color:#92400e;">فاتورة شراء</p>
    <p style="font-size:14px;color:#666;">رقم: ${invoice.invoiceNumber}</p>
    <p style="font-size:13px;color:#666;">التاريخ: ${date}</p>
  </div>
</div>

<div class="invoice-info">
  <div class="info-box">
    <h3>معلومات المورد</h3>
    <p>المورد: ${invoice.supplierName}</p>
  </div>
  <div class="info-box">
    <h3>تفاصيل الفاتورة</h3>
    <p>تاريخ الاستحقاق: ${dueDate}</p>
    <p>الحالة: <span class="status-${invoice.status}">${statusLabel}</span></p>
    <p>المخزن: ${warehouse}</p>
  </div>
</div>

<table>
  <thead>
    <tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
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

function openInvoice(invoice: SupplierInvoice) {
  const html = buildInvoiceHTML(invoice);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    getSupplierInvoices().then((data) => setInvoices(data as SupplierInvoice[]));
  }, []);

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    return (
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplierName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalAmount  = filtered.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid    = filtered.reduce((s, i) => s + i.paidAmount, 0);
  const totalUnpaid  = totalAmount - totalPaid;

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">فواتير الشراء</h1>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">إجمالي الفواتير</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">المدفوع</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-2xl p-4">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">المتبقي</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{formatCurrency(totalUnpaid)}</p>
          </div>
        </div>

        {/* Search */}
        <input
          className="w-full sm:w-72 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400/50"
          placeholder="بحث برقم الفاتورة أو المورد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Card title={`الفواتير (${filtered.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                  <th className="pb-3 font-medium text-right">رقم الفاتورة</th>
                  <th className="pb-3 font-medium text-right">المورد</th>
                  <th className="pb-3 font-medium text-right">التاريخ</th>
                  <th className="pb-3 font-medium text-right">المبلغ</th>
                  <th className="pb-3 font-medium text-right">المدفوع</th>
                  <th className="pb-3 font-medium text-right">المتبقي</th>
                  <th className="pb-3 font-medium text-right">الحالة</th>
                  <th className="pb-3 font-medium text-right">الفاتورة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 font-mono text-xs text-gray-500 dark:text-slate-400">{inv.invoiceNumber}</td>
                    <td className="py-3 font-semibold text-gray-900 dark:text-slate-100">{inv.supplierName}</td>
                    <td className="py-3 text-gray-500 dark:text-slate-400">{formatDate(inv.date)}</td>
                    <td className="py-3 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paidAmount)}</td>
                    <td className="py-3 text-red-600 dark:text-red-400 font-medium">{formatCurrency(inv.totalAmount - inv.paidAmount)}</td>
                    <td className="py-3"><StatusBadge status={inv.status} /></td>
                    <td className="py-3">
                      <button
                        onClick={() => openInvoice(inv)}
                        className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        عرض / طباعة
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 dark:text-slate-500 py-10">
                      <div className="text-3xl mb-2">🧾</div>
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
