"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import InvoiceForm from "@/components/forms/InvoiceForm";
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getSalesInvoices,
  addSalesInvoice,
  addCustomerPayment,
  updateSalesInvoice,
} from "@/lib/firestore";
import { formatCurrency, formatDate, todayString } from "@/lib/utils";
import { Customer, SalesInvoice } from "@/types";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";

export default function SalesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [tab, setTab] = useState<"invoices" | "customers" | "statement">("invoices");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [targetInvoice, setTargetInvoice] = useState<SalesInvoice | null>(null);
  const [custForm, setCustForm] = useState({ name: "", contact: "", address: "" });
  const [payForm, setPayForm] = useState({ amount: 0, date: todayString(), note: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [custs, invs] = await Promise.all([getCustomers(), getSalesInvoices()]);
    setCustomers(custs as Customer[]);
    setInvoices(invs as SalesInvoice[]);
  }

  async function saveCustomer() {
    if (!custForm.name.trim()) { toast.error("يرجى إدخال اسم العميل"); return; }
    setLoading(true);
    try {
      if (editCustomer) {
        await updateCustomer(editCustomer.id, custForm);
        toast.success("تم تحديث العميل");
      } else {
        await addCustomer(custForm);
        toast.success("تم إضافة العميل");
      }
      setCustomerModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleDeleteCustomer(id: string) {
    if (!confirm("هل أنت متأكد؟")) return;
    await deleteCustomer(id);
    toast.success("تم الحذف");
    loadData();
  }

  async function handleCreateInvoice(data: Record<string, unknown>) {
    await addSalesInvoice(data);
    toast.success("تم إنشاء فاتورة البيع");
    setInvoiceModal(false);
    loadData();
  }

  async function handlePayment() {
    if (!targetInvoice || payForm.amount <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    setLoading(true);
    try {
      await addCustomerPayment({
        customerId: targetInvoice.customerId,
        customerName: targetInvoice.customerName,
        invoiceIds: [targetInvoice.id],
        amount: payForm.amount,
        date: Timestamp.fromDate(new Date(payForm.date)),
        note: payForm.note,
      });
      toast.success("تم تسجيل تحصيل الدفع");
      setPaymentModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function generatePdf(invoice: SalesInvoice) {
    toast.loading("جاري إنشاء الفاتورة...");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, type: "customer" }),
      });
      const { url } = await res.json();
      if (url) {
        await updateSalesInvoice(invoice.id, { pdfUrl: url });
        window.open(url, "_blank");
        toast.dismiss();
        toast.success("تم إنشاء الفاتورة");
        loadData();
      }
    } catch { toast.dismiss(); toast.error("فشل إنشاء الفاتورة"); }
  }

  const statementInvoices = selectedCustomer
    ? invoices.filter((i) => i.customerId === selectedCustomer.id)
    : [];
  const statementBalance = statementInvoices.reduce(
    (s, i) => s + (i.totalAmount - i.paidAmount),
    0
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">المبيعات والعملاء</h1>
          <Button onClick={() => setInvoiceModal(true)}>+ فاتورة بيع جديدة</Button>
        </div>

        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {[
            { key: "invoices", label: "فواتير البيع" },
            { key: "customers", label: "العملاء" },
            { key: "statement", label: "كشف حساب عميل" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-amber-700 text-amber-700" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "invoices" && (
          <Card title={`فواتير البيع (${invoices.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">رقم الفاتورة</th>
                    <th className="pb-2 font-medium">العميل</th>
                    <th className="pb-2 font-medium">التاريخ</th>
                    <th className="pb-2 font-medium">المبلغ</th>
                    <th className="pb-2 font-medium">المحصّل</th>
                    <th className="pb-2 font-medium">الحالة</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2 font-medium">{inv.customerName}</td>
                      <td className="py-2 text-gray-500 dark:text-slate-500">{formatDate(inv.date)}</td>
                      <td className="py-2 text-amber-700 font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-2 text-green-600">{formatCurrency(inv.paidAmount)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => { setTargetInvoice(inv); setPayForm({ amount: inv.totalAmount - inv.paidAmount, date: todayString(), note: "" }); setPaymentModal(true); }}
                              className="text-xs text-green-700 hover:underline px-1"
                            >
                              تحصيل
                            </button>
                          )}
                          <button onClick={() => generatePdf(inv)} className="text-xs text-blue-600 hover:underline px-1">PDF</button>
                          {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-500 dark:text-slate-500 hover:underline px-1">تحميل</a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && (
                    <tr><td colSpan={7} className="text-center text-gray-400 dark:text-slate-600 py-6">لا توجد فواتير بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "customers" && (
          <Card
            title={`العملاء (${customers.length})`}
            actions={
              <Button size="sm" onClick={() => { setEditCustomer(null); setCustForm({ name: "", contact: "", address: "" }); setCustomerModal(true); }}>
                + إضافة عميل
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2 font-medium">التواصل</th>
                    <th className="pb-2 font-medium">العنوان</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => (
                    <tr key={cust.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="py-2 font-medium">{cust.name}</td>
                      <td className="py-2 text-gray-500 dark:text-slate-500">{cust.contact}</td>
                      <td className="py-2 text-gray-500 dark:text-slate-500">{cust.address}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setSelectedCustomer(cust); setTab("statement"); }} className="text-xs text-blue-600 hover:underline px-1">كشف حساب</button>
                          <button onClick={() => { setEditCustomer(cust); setCustForm({ name: cust.name, contact: cust.contact, address: cust.address }); setCustomerModal(true); }} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                          <button onClick={() => handleDeleteCustomer(cust.id)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!customers.length && (
                    <tr><td colSpan={4} className="text-center text-gray-400 dark:text-slate-600 py-6">لا يوجد عملاء بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "statement" && (
          <div className="space-y-4">
            <div className="max-w-xs">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-1">اختر عميلاً</label>
              <select
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                value={selectedCustomer?.id || ""}
                onChange={(e) => setSelectedCustomer(customers.find((c) => c.id === e.target.value) || null)}
              >
                <option value="">اختر العميل</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedCustomer && (
              <Card title={`كشف حساب: ${selectedCustomer.name}`}>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">إجمالي المستحق من العميل</span>
                  <span className="text-lg font-bold text-blue-700">{formatCurrency(statementBalance)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                        <th className="pb-2 font-medium">رقم الفاتورة</th>
                        <th className="pb-2 font-medium">التاريخ</th>
                        <th className="pb-2 font-medium">المبلغ</th>
                        <th className="pb-2 font-medium">المحصّل</th>
                        <th className="pb-2 font-medium">المتبقي</th>
                        <th className="pb-2 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-50">
                          <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                          <td className="py-2">{formatDate(inv.date)}</td>
                          <td className="py-2">{formatCurrency(inv.totalAmount)}</td>
                          <td className="py-2 text-green-600">{formatCurrency(inv.paidAmount)}</td>
                          <td className="py-2 text-blue-600">{formatCurrency(inv.totalAmount - inv.paidAmount)}</td>
                          <td className="py-2"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                      {!statementInvoices.length && (
                        <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-600 py-4">لا توجد فواتير</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="فاتورة بيع جديدة" size="xl">
        <InvoiceForm
          type="customer"
          parties={customers.map((c) => ({ id: c.id, name: c.name }))}
          onSubmit={handleCreateInvoice}
          onCancel={() => setInvoiceModal(false)}
        />
      </Modal>

      <Modal open={customerModal} onClose={() => setCustomerModal(false)} title={editCustomer ? "تعديل عميل" : "إضافة عميل جديد"} size="sm">
        <div className="space-y-4">
          <Input label="الاسم" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
          <Input label="التواصل" value={custForm.contact} onChange={(e) => setCustForm({ ...custForm, contact: e.target.value })} />
          <Input label="العنوان" value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCustomerModal(false)}>إلغاء</Button>
            <Button onClick={saveCustomer} loading={loading}>{editCustomer ? "تحديث" : "إضافة"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="تسجيل تحصيل" size="sm">
        <div className="space-y-4">
          {targetInvoice && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium">{targetInvoice.customerName}</p>
              <p className="text-blue-600">المستحق: {formatCurrency(targetInvoice.totalAmount - targetInvoice.paidAmount)}</p>
            </div>
          )}
          <Input label="المبلغ المحصّل" type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
          <Input label="التاريخ" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
          <Input label="ملاحظة" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentModal(false)}>إلغاء</Button>
            <Button onClick={handlePayment} loading={loading}>تأكيد التحصيل</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
