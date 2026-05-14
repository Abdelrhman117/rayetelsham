"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { getSupplierInvoices, getSalesInvoices, updateSupplierInvoice, updateSalesInvoice } from "@/lib/firestore";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { SupplierInvoice, SalesInvoice } from "@/types";
import { toast } from "sonner";

type AnyInvoice = (SupplierInvoice & { invoiceType: "supplier" }) | (SalesInvoice & { invoiceType: "customer" });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<AnyInvoice[]>([]);
  const [tab, setTab] = useState<"all" | "supplier" | "customer">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    const [supInvs, salInvs] = await Promise.all([getSupplierInvoices(), getSalesInvoices()]);
    const combined: AnyInvoice[] = [
      ...(supInvs as SupplierInvoice[]).map((i) => ({ ...i, invoiceType: "supplier" as const })),
      ...(salInvs as SalesInvoice[]).map((i) => ({ ...i, invoiceType: "customer" as const })),
    ].sort((a, b) => {
      const dateA = a.date instanceof Object && "toDate" in a.date ? a.date.toDate() : new Date(a.date as unknown as string);
      const dateB = b.date instanceof Object && "toDate" in b.date ? b.date.toDate() : new Date(b.date as unknown as string);
      return dateB.getTime() - dateA.getTime();
    });
    setInvoices(combined);
  }

  async function generatePdf(invoice: AnyInvoice) {
    toast.loading("جاري إنشاء الفاتورة...");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, type: invoice.invoiceType }),
      });
      const { url } = await res.json();
      if (url) {
        if (invoice.invoiceType === "supplier") {
          await updateSupplierInvoice(invoice.id, { pdfUrl: url });
        } else {
          await updateSalesInvoice(invoice.id, { pdfUrl: url });
        }
        window.open(url, "_blank");
        toast.dismiss();
        toast.success("تم إنشاء الفاتورة");
        loadInvoices();
      }
    } catch {
      toast.dismiss();
      toast.error("فشل إنشاء الفاتورة");
    }
  }

  const filtered = invoices.filter((inv) => {
    const matchTab =
      tab === "all" ||
      (tab === "supplier" && inv.invoiceType === "supplier") ||
      (tab === "customer" && inv.invoiceType === "customer");
    const party = inv.invoiceType === "supplier" ? (inv as SupplierInvoice).supplierName : (inv as SalesInvoice).customerName;
    const matchSearch = !search || inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || party.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">الفواتير</h1>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex gap-2 border-b border-gray-200 w-full sm:w-auto">
            {[
              { key: "all", label: "الكل" },
              { key: "supplier", label: "فواتير شراء" },
              { key: "customer", label: "فواتير بيع" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key ? "border-amber-700 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
            placeholder="بحث برقم الفاتورة أو الطرف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card title={`الفواتير (${filtered.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-600">
                  <th className="pb-2 font-medium">النوع</th>
                  <th className="pb-2 font-medium">رقم الفاتورة</th>
                  <th className="pb-2 font-medium">الطرف</th>
                  <th className="pb-2 font-medium">التاريخ</th>
                  <th className="pb-2 font-medium">المبلغ</th>
                  <th className="pb-2 font-medium">المدفوع</th>
                  <th className="pb-2 font-medium">الحالة</th>
                  <th className="pb-2 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const party = inv.invoiceType === "supplier"
                    ? (inv as SupplierInvoice).supplierName
                    : (inv as SalesInvoice).customerName;
                  return (
                    <tr key={`${inv.invoiceType}-${inv.id}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.invoiceType === "supplier"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {inv.invoiceType === "supplier" ? "شراء" : "بيع"}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2 font-medium">{party}</td>
                      <td className="py-2 text-gray-500">{formatDate(inv.date)}</td>
                      <td className="py-2 font-medium text-amber-700">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-2 text-green-600">{formatCurrency(inv.paidAmount)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => generatePdf(inv)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            إنشاء PDF
                          </button>
                          {inv.pdfUrl && (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-gray-500 hover:underline mr-1"
                            >
                              تحميل
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-8">
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
