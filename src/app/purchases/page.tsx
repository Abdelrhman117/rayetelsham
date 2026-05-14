"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import InvoiceForm from "@/components/forms/InvoiceForm";
import {
  getSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierInvoices,
  addSupplierInvoice,
  addSupplierPayment,
  updateSupplierInvoice,
} from "@/lib/firestore";
import { formatCurrency, formatDate, todayString } from "@/lib/utils";
import { Supplier, SupplierInvoice } from "@/types";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [tab, setTab] = useState<"invoices" | "suppliers" | "statement">("invoices");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [targetInvoice, setTargetInvoice] = useState<SupplierInvoice | null>(null);

  // Supplier form
  const [supForm, setSupForm] = useState({ name: "", contact: "", address: "" });

  // Payment form
  const [payForm, setPayForm] = useState({ amount: 0, date: todayString(), note: "" });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [sups, invs] = await Promise.all([getSuppliers(), getSupplierInvoices()]);
    setSuppliers(sups as Supplier[]);
    setInvoices(invs as SupplierInvoice[]);
  }

  async function saveSupplier() {
    if (!supForm.name.trim()) { toast.error("يرجى إدخال اسم المورد"); return; }
    setLoading(true);
    try {
      if (editSupplier) {
        await updateSupplier(editSupplier.id, supForm);
        toast.success("تم تحديث المورد");
      } else {
        await addSupplier(supForm);
        toast.success("تم إضافة المورد");
      }
      setSupplierModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleDeleteSupplier(id: string) {
    if (!confirm("هل أنت متأكد؟")) return;
    await deleteSupplier(id);
    toast.success("تم الحذف");
    loadData();
  }

  async function handleCreateInvoice(data: Record<string, unknown>) {
    await addSupplierInvoice(data);
    toast.success("تم إنشاء فاتورة الشراء");
    setInvoiceModal(false);
    loadData();
  }

  async function handlePayment() {
    if (!targetInvoice || payForm.amount <= 0) { toast.error("يرجى إدخال المبلغ"); return; }
    setLoading(true);
    try {
      await addSupplierPayment({
        supplierId: targetInvoice.supplierId,
        supplierName: targetInvoice.supplierName,
        invoiceIds: [targetInvoice.id],
        amount: payForm.amount,
        date: Timestamp.fromDate(new Date(payForm.date)),
        note: payForm.note,
      });
      toast.success("تم تسجيل الدفع");
      setPaymentModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function generatePdf(invoice: SupplierInvoice) {
    toast.loading("جاري إنشاء الفاتورة...");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, type: "supplier" }),
      });
      const { url } = await res.json();
      if (url) {
        await updateSupplierInvoice(invoice.id, { pdfUrl: url });
        window.open(url, "_blank");
        toast.dismiss();
        toast.success("تم إنشاء الفاتورة");
        loadData();
      }
    } catch { toast.dismiss(); toast.error("فشل إنشاء الفاتورة"); }
  }

  const statementInvoices = selectedSupplier
    ? invoices.filter((i) => i.supplierId === selectedSupplier.id)
    : [];
  const statementBalance = statementInvoices.reduce(
    (s, i) => s + (i.totalAmount - i.paidAmount),
    0
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">المشتريات والموردون</h1>
          <Button onClick={() => setInvoiceModal(true)}>+ فاتورة شراء جديدة</Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {[
            { key: "invoices", label: "فواتير الشراء" },
            { key: "suppliers", label: "الموردون" },
            { key: "statement", label: "كشف حساب مورد" },
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

        {tab === "invoices" && (
          <Card title={`فواتير الشراء (${invoices.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-600">
                    <th className="pb-2 font-medium">رقم الفاتورة</th>
                    <th className="pb-2 font-medium">المورد</th>
                    <th className="pb-2 font-medium">التاريخ</th>
                    <th className="pb-2 font-medium">المبلغ الكلي</th>
                    <th className="pb-2 font-medium">المدفوع</th>
                    <th className="pb-2 font-medium">الحالة</th>
                    <th className="pb-2 font-medium">المخزن</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2 font-medium">{inv.supplierName}</td>
                      <td className="py-2 text-gray-500">{formatDate(inv.date)}</td>
                      <td className="py-2 text-amber-700 font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-2">{formatCurrency(inv.paidAmount)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2 text-gray-500">{inv.receivingWarehouse === "main" ? "المخزن الرئيسي" : "المحل"}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => { setTargetInvoice(inv); setPayForm({ amount: inv.totalAmount - inv.paidAmount, date: todayString(), note: "" }); setPaymentModal(true); }}
                              className="text-xs text-green-700 hover:underline px-1"
                            >
                              دفع
                            </button>
                          )}
                          <button
                            onClick={() => generatePdf(inv)}
                            className="text-xs text-blue-600 hover:underline px-1"
                          >
                            PDF
                          </button>
                          {inv.pdfUrl && (
                            <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:underline px-1">
                              تحميل
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-6">لا توجد فواتير بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "suppliers" && (
          <Card
            title={`الموردون (${suppliers.length})`}
            actions={
              <Button size="sm" onClick={() => { setEditSupplier(null); setSupForm({ name: "", contact: "", address: "" }); setSupplierModal(true); }}>
                + إضافة مورد
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-600">
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2 font-medium">التواصل</th>
                    <th className="pb-2 font-medium">العنوان</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium">{sup.name}</td>
                      <td className="py-2 text-gray-500">{sup.contact}</td>
                      <td className="py-2 text-gray-500">{sup.address}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setSelectedSupplier(sup); setTab("statement"); }} className="text-xs text-blue-600 hover:underline px-1">كشف حساب</button>
                          <button onClick={() => { setEditSupplier(sup); setSupForm({ name: sup.name, contact: sup.contact, address: sup.address }); setSupplierModal(true); }} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                          <button onClick={() => handleDeleteSupplier(sup.id)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!suppliers.length && (
                    <tr><td colSpan={4} className="text-center text-gray-400 py-6">لا يوجد موردون بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "statement" && (
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium text-gray-700 block mb-1">اختر مورداً</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={selectedSupplier?.id || ""}
                  onChange={(e) => setSelectedSupplier(suppliers.find((s) => s.id === e.target.value) || null)}
                >
                  <option value="">اختر المورد</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {selectedSupplier && (
              <Card title={`كشف حساب: ${selectedSupplier.name}`}>
                <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">الرصيد المستحق للمورد</span>
                  <span className="text-lg font-bold text-red-700">{formatCurrency(statementBalance)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-600">
                        <th className="pb-2 font-medium">رقم الفاتورة</th>
                        <th className="pb-2 font-medium">التاريخ</th>
                        <th className="pb-2 font-medium">المبلغ</th>
                        <th className="pb-2 font-medium">المدفوع</th>
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
                          <td className="py-2 text-red-600">{formatCurrency(inv.totalAmount - inv.paidAmount)}</td>
                          <td className="py-2"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                      {!statementInvoices.length && (
                        <tr><td colSpan={6} className="text-center text-gray-400 py-4">لا توجد فواتير لهذا المورد</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="فاتورة شراء جديدة" size="xl">
        <InvoiceForm
          type="supplier"
          parties={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          onSubmit={handleCreateInvoice}
          onCancel={() => setInvoiceModal(false)}
        />
      </Modal>

      {/* Supplier Modal */}
      <Modal open={supplierModal} onClose={() => setSupplierModal(false)} title={editSupplier ? "تعديل مورد" : "إضافة مورد جديد"} size="sm">
        <div className="space-y-4">
          <Input label="الاسم" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
          <Input label="التواصل (هاتف/واتساب)" value={supForm.contact} onChange={(e) => setSupForm({ ...supForm, contact: e.target.value })} />
          <Input label="العنوان" value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSupplierModal(false)}>إلغاء</Button>
            <Button onClick={saveSupplier} loading={loading}>{editSupplier ? "تحديث" : "إضافة"}</Button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="تسجيل دفع للمورد" size="sm">
        <div className="space-y-4">
          {targetInvoice && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm">
              <p className="font-medium">{targetInvoice.supplierName}</p>
              <p className="text-gray-600">الفاتورة: {targetInvoice.invoiceNumber}</p>
              <p className="text-red-600">المتبقي: {formatCurrency(targetInvoice.totalAmount - targetInvoice.paidAmount)}</p>
            </div>
          )}
          <Input label="المبلغ المدفوع" type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
          <Input label="تاريخ الدفع" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
          <Input label="ملاحظة" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentModal(false)}>إلغاء</Button>
            <Button onClick={handlePayment} loading={loading}>تأكيد الدفع</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
