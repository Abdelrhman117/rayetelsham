"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import InvoiceForm from "@/components/forms/InvoiceForm";
import {
  getSuppliers, addSupplier, updateSupplier, deleteSupplier,
  getSupplierInvoices, addSupplierInvoice, addSupplierPayment,
  updateSupplierInvoice, deleteSupplierInvoice,
  getSupplierReturns, addSupplierReturn,
} from "@/lib/firestore";
import { formatCurrency, formatDate, todayString } from "@/lib/utils";
import { Supplier, SupplierInvoice, SupplierReturn } from "@/types";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [tab, setTab] = useState<"invoices" | "returns" | "suppliers" | "statement">("invoices");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [editInvoiceModal, setEditInvoiceModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [targetInvoice, setTargetInvoice] = useState<SupplierInvoice | null>(null);

  // Supplier form
  const [supForm, setSupForm] = useState({ name: "", contact: "", address: "" });
  // Payment form
  const [payForm, setPayForm] = useState({ amount: 0, date: todayString(), note: "" });
  // Return form
  const [returnType, setReturnType] = useState<"goods" | "credit">("goods");
  const [returnItems, setReturnItems] = useState<{ name: string; unit: string; quantity: number; unitPrice: number; total: number }[]>([]);
  const [creditAmount, setCreditAmount] = useState(0);
  const [returnDate, setReturnDate] = useState(todayString());
  const [returnNote, setReturnNote] = useState("");

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (tab === "returns") loadReturns(); }, [tab]);

  async function loadData() {
    const [sups, invs] = await Promise.all([getSuppliers(), getSupplierInvoices()]);
    setSuppliers(sups as Supplier[]);
    setInvoices(invs as SupplierInvoice[]);
  }

  async function loadReturns() {
    const data = await getSupplierReturns();
    setReturns(data as SupplierReturn[]);
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
    } catch { toast.error("حدث خطأ"); } finally { setLoading(false); }
  }

  async function handleDeleteSupplier(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المورد؟")) return;
    try {
      await deleteSupplier(id);
      toast.success("تم الحذف");
      loadData();
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    }
  }

  async function handleCreateInvoice(data: Record<string, unknown>) {
    await addSupplierInvoice(data);
    toast.success("تم إنشاء فاتورة الشراء وتحديث المخزون");
    setInvoiceModal(false);
    loadData();
  }

  async function handleEditInvoice(data: Record<string, unknown>) {
    if (!targetInvoice) return;
    await updateSupplierInvoice(targetInvoice.id, data);
    toast.success("تم تحديث الفاتورة");
    setEditInvoiceModal(false);
    loadData();
  }

  async function handleDeleteInvoice(inv: SupplierInvoice) {
    if (!confirm(`تحذير: حذف الفاتورة لن يعكس تأثيرها على المخزون تلقائياً.\n\nهل أنت متأكد من حذف فاتورة ${inv.invoiceNumber}؟`)) return;
    try {
      await deleteSupplierInvoice(inv.id);
      toast.success("تم حذف الفاتورة");
      loadData();
    } catch { toast.error("حدث خطأ"); }
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
    } catch { toast.error("حدث خطأ"); } finally { setLoading(false); }
  }

  function openReturnModal(inv: SupplierInvoice) {
    setTargetInvoice(inv);
    setReturnType("goods");
    // Pre-fill items from invoice
    setReturnItems(inv.items.map(item => ({ ...item, quantity: 0 })));
    setCreditAmount(0);
    setReturnDate(todayString());
    setReturnNote("");
    setReturnModal(true);
  }

  function updateReturnItem(idx: number, field: string, value: number | string) {
    setReturnItems(prev => {
      const updated = [...prev];
      (updated[idx] as Record<string, unknown>)[field] = value;
      if (field === "quantity") {
        updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
      }
      return updated;
    });
  }

  async function handleReturn() {
    if (!targetInvoice) return;
    setLoading(true);
    try {
      const activeItems = returnItems.filter(i => i.quantity > 0);
      if (returnType === "goods" && activeItems.length === 0) {
        toast.error("يرجى إدخال كميات المرتجع");
        setLoading(false);
        return;
      }
      if (returnType === "credit" && creditAmount <= 0) {
        toast.error("يرجى إدخال مبلغ الفرق");
        setLoading(false);
        return;
      }
      const totalAmount = returnType === "goods"
        ? activeItems.reduce((s, i) => s + i.total, 0)
        : creditAmount;

      await addSupplierReturn({
        supplierId: targetInvoice.supplierId,
        supplierName: targetInvoice.supplierName,
        invoiceId: targetInvoice.id,
        invoiceNumber: targetInvoice.invoiceNumber,
        date: returnDate,
        returnType,
        items: returnType === "goods" ? activeItems : [],
        creditAmount: returnType === "credit" ? creditAmount : 0,
        totalAmount,
        warehouse: targetInvoice.receivingWarehouse,
        note: returnNote,
      });
      toast.success(returnType === "goods" ? "تم تسجيل المرتجع وخصم المخزون" : "تم تسجيل فرق الحساب");
      setReturnModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); } finally { setLoading(false); }
  }

  const statementInvoices = selectedSupplier ? invoices.filter(i => i.supplierId === selectedSupplier.id) : [];
  const statementBalance = statementInvoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const totalReturns = returns.reduce((s, r) => s + r.totalAmount, 0);

  const tabs = [
    { key: "invoices",   label: "فواتير الشراء"    },
    { key: "returns",    label: "المرتجعات"         },
    { key: "suppliers",  label: "الموردون"           },
    { key: "statement",  label: "كشف حساب"          },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">المشتريات والموردون</h1>
          <Button onClick={() => setInvoiceModal(true)}>+ فاتورة شراء جديدة</Button>
        </div>

        <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-yellow-500 text-yellow-600 dark:text-yellow-400 dark:border-yellow-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── INVOICES TAB ── */}
        {tab === "invoices" && (
          <Card title={`فواتير الشراء (${invoices.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="pb-3 font-medium text-right">رقم الفاتورة</th>
                    <th className="pb-3 font-medium text-right">المورد</th>
                    <th className="pb-3 font-medium text-right">التاريخ</th>
                    <th className="pb-3 font-medium text-right">المبلغ</th>
                    <th className="pb-3 font-medium text-right">المدفوع</th>
                    <th className="pb-3 font-medium text-right">الحالة</th>
                    <th className="pb-3 font-medium text-right">المخزن</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 font-mono text-xs text-gray-500 dark:text-slate-400">{inv.invoiceNumber}</td>
                      <td className="py-3 font-semibold text-gray-900 dark:text-slate-100">{inv.supplierName}</td>
                      <td className="py-3 text-gray-500 dark:text-slate-400">{formatDate(inv.date)}</td>
                      <td className="py-3 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paidAmount)}</td>
                      <td className="py-3"><StatusBadge status={inv.status} /></td>
                      <td className="py-3 text-gray-500 dark:text-slate-400 text-xs">{inv.receivingWarehouse === "main" ? "المخزن الرئيسي" : "المحل"}</td>
                      <td className="py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => { setTargetInvoice(inv); setPayForm({ amount: inv.totalAmount - inv.paidAmount, date: todayString(), note: "" }); setPaymentModal(true); }}
                              className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 px-2 py-1 rounded-lg"
                            >دفع</button>
                          )}
                          <button
                            onClick={() => openReturnModal(inv)}
                            className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 px-2 py-1 rounded-lg"
                          >مرتجع</button>
                          <button
                            onClick={() => { setTargetInvoice(inv); setEditInvoiceModal(true); }}
                            className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 px-2 py-1 rounded-lg"
                          >تعديل</button>
                          <button
                            onClick={() => handleDeleteInvoice(inv)}
                            className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 px-2 py-1 rounded-lg"
                          >حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && (
                    <tr><td colSpan={8} className="text-center text-gray-400 dark:text-slate-500 py-10">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span className="text-sm">لا توجد فواتير بعد</span>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── RETURNS TAB ── */}
        {tab === "returns" && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 rounded-2xl p-4">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">إجمالي المرتجعات</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">{formatCurrency(totalReturns)}</p>
            </div>
            <Card title={`المرتجعات (${returns.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                      <th className="pb-3 font-medium text-right">التاريخ</th>
                      <th className="pb-3 font-medium text-right">المورد</th>
                      <th className="pb-3 font-medium text-right">الفاتورة</th>
                      <th className="pb-3 font-medium text-right">النوع</th>
                      <th className="pb-3 font-medium text-right">القيمة</th>
                      <th className="pb-3 font-medium text-right">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-700/30">
                        <td className="py-3 text-gray-600 dark:text-slate-300">{r.date}</td>
                        <td className="py-3 font-semibold text-gray-900 dark:text-slate-100">{r.supplierName}</td>
                        <td className="py-3 font-mono text-xs text-gray-500 dark:text-slate-400">{r.invoiceNumber}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            r.returnType === "goods"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          }`}>
                            {r.returnType === "goods" ? "مرتجع بضاعة" : "فرق حساب"}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-orange-700 dark:text-orange-300">{formatCurrency(r.totalAmount)}</td>
                        <td className="py-3 text-gray-500 dark:text-slate-400 text-xs">{r.note}</td>
                      </tr>
                    ))}
                    {!returns.length && (
                      <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-500 py-10">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          <span className="text-sm">لا توجد مرتجعات</span>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── SUPPLIERS TAB ── */}
        {tab === "suppliers" && (
          <Card
            title={`الموردون (${suppliers.length})`}
            actions={<Button size="sm" onClick={() => { setEditSupplier(null); setSupForm({ name: "", contact: "", address: "" }); setSupplierModal(true); }}>+ إضافة مورد</Button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="pb-3 font-medium text-right">الاسم</th>
                    <th className="pb-3 font-medium text-right">التواصل</th>
                    <th className="pb-3 font-medium text-right">العنوان</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(sup => (
                    <tr key={sup.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 font-semibold text-gray-900 dark:text-slate-100">{sup.name}</td>
                      <td className="py-3 text-gray-500 dark:text-slate-400">{sup.contact}</td>
                      <td className="py-3 text-gray-500 dark:text-slate-400">{sup.address}</td>
                      <td className="py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setSelectedSupplier(sup); setTab("statement"); }} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 px-2 py-1 rounded-lg">كشف حساب</button>
                          <button onClick={() => { setEditSupplier(sup); setSupForm({ name: sup.name, contact: sup.contact, address: sup.address }); setSupplierModal(true); }} className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 px-2 py-1 rounded-lg">تعديل</button>
                          <button onClick={() => handleDeleteSupplier(sup.id)} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 px-2 py-1 rounded-lg">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!suppliers.length && <tr><td colSpan={4} className="text-center text-gray-400 dark:text-slate-500 py-8">لا يوجد موردون بعد</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── STATEMENT TAB ── */}
        {tab === "statement" && (
          <div className="space-y-4">
            <div className="max-w-xs">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-1">اختر مورداً</label>
              <select
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm"
                value={selectedSupplier?.id || ""}
                onChange={e => setSelectedSupplier(suppliers.find(s => s.id === e.target.value) || null)}
              >
                <option value="">اختر المورد</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedSupplier && (
              <Card title={`كشف حساب: ${selectedSupplier.name}`}>
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">الرصيد المستحق للمورد</span>
                  <span className="text-xl font-bold text-red-700 dark:text-red-300">{formatCurrency(statementBalance)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                        <th className="pb-2 font-medium text-right">رقم الفاتورة</th>
                        <th className="pb-2 font-medium text-right">التاريخ</th>
                        <th className="pb-2 font-medium text-right">المبلغ</th>
                        <th className="pb-2 font-medium text-right">المدفوع</th>
                        <th className="pb-2 font-medium text-right">المتبقي</th>
                        <th className="pb-2 font-medium text-right">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementInvoices.map(inv => (
                        <tr key={inv.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                          <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                          <td className="py-2">{formatDate(inv.date)}</td>
                          <td className="py-2 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(inv.totalAmount)}</td>
                          <td className="py-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paidAmount)}</td>
                          <td className="py-2 text-red-600 dark:text-red-400">{formatCurrency(inv.totalAmount - inv.paidAmount)}</td>
                          <td className="py-2"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                      {!statementInvoices.length && <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-500 py-6">لا توجد فواتير لهذا المورد</td></tr>}
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
          parties={suppliers.map(s => ({ id: s.id, name: s.name }))}
          onSubmit={handleCreateInvoice}
          onCancel={() => setInvoiceModal(false)}
        />
      </Modal>

      {/* Edit Invoice Modal */}
      {targetInvoice && (
        <Modal open={editInvoiceModal} onClose={() => setEditInvoiceModal(false)} title={`تعديل فاتورة: ${targetInvoice.invoiceNumber}`} size="xl">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-300">
            ⚠️ تعديل الفاتورة لن يؤثر على المخزون تلقائياً. عدّل المخزون يدوياً إن لزم.
          </div>
          <InvoiceForm
            type="supplier"
            parties={suppliers.map(s => ({ id: s.id, name: s.name }))}
            onSubmit={handleEditInvoice}
            onCancel={() => setEditInvoiceModal(false)}
            submitLabel="حفظ التعديلات"
            initialValues={{
              partyId: targetInvoice.supplierId,
              partyName: targetInvoice.supplierName,
              date: (targetInvoice.date as unknown as { toDate: () => Date }).toDate().toISOString().split("T")[0],
              dueDate: targetInvoice.dueDate ? (targetInvoice.dueDate as unknown as { toDate: () => Date }).toDate().toISOString().split("T")[0] : "",
              receivingWarehouse: targetInvoice.receivingWarehouse,
              note: targetInvoice.note || "",
              items: targetInvoice.items,
            }}
          />
        </Modal>
      )}

      {/* Supplier Modal */}
      <Modal open={supplierModal} onClose={() => setSupplierModal(false)} title={editSupplier ? "تعديل مورد" : "إضافة مورد جديد"} size="sm">
        <div className="space-y-4">
          <Input label="الاسم" value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} />
          <Input label="التواصل (هاتف/واتساب)" value={supForm.contact} onChange={e => setSupForm({ ...supForm, contact: e.target.value })} />
          <Input label="العنوان" value={supForm.address} onChange={e => setSupForm({ ...supForm, address: e.target.value })} />
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
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-sm space-y-1">
              <p className="font-semibold text-gray-900 dark:text-slate-100">{targetInvoice.supplierName}</p>
              <p className="text-gray-500 dark:text-slate-400">الفاتورة: {targetInvoice.invoiceNumber}</p>
              <p className="text-red-600 dark:text-red-400 font-medium">المتبقي: {formatCurrency(targetInvoice.totalAmount - targetInvoice.paidAmount)}</p>
            </div>
          )}
          <Input label="المبلغ المدفوع" type="number" min={0} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
          <Input label="تاريخ الدفع" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
          <Input label="ملاحظة" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentModal(false)}>إلغاء</Button>
            <Button onClick={handlePayment} loading={loading}>تأكيد الدفع</Button>
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      {targetInvoice && (
        <Modal open={returnModal} onClose={() => setReturnModal(false)} title={`مرتجع — ${targetInvoice.invoiceNumber}`} size="lg">
          <div className="space-y-4">
            {/* Invoice info */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-gray-900 dark:text-slate-100">{targetInvoice.supplierName}</p>
              <p className="text-gray-500 dark:text-slate-400">إجمالي الفاتورة: {formatCurrency(targetInvoice.totalAmount)}</p>
            </div>

            {/* Return type */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-2">نوع المرتجع</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setReturnType("goods")}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    returnType === "goods"
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                      : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-300"
                  }`}
                >
                  <div className="flex justify-center mb-1.5"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                  <div>مرتجع بضاعة</div>
                  <div className="text-xs opacity-70 mt-0.5">بضاعة فيها مشكلة</div>
                </button>
                <button
                  onClick={() => setReturnType("credit")}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    returnType === "credit"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-blue-300"
                  }`}
                >
                  <div className="flex justify-center mb-1.5"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                  <div>فرق حساب</div>
                  <div className="text-xs opacity-70 mt-0.5">فرق سعر أو كريدت</div>
                </button>
              </div>
            </div>

            {/* Goods return — items table */}
            {returnType === "goods" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-2">كميات المرتجع (اترك 0 للأصناف غير المرتجعة)</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                        <th className="pb-2 font-medium text-right">الصنف</th>
                        <th className="pb-2 font-medium text-right">الكمية الأصلية</th>
                        <th className="pb-2 font-medium text-right">الكمية المرتجعة</th>
                        <th className="pb-2 font-medium text-right">القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 dark:border-slate-700/50">
                          <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{item.name}</td>
                          <td className="py-2 text-gray-500 dark:text-slate-400">{targetInvoice.items[idx]?.quantity} {item.unit}</td>
                          <td className="py-2">
                            <input
                              type="number"
                              min={0}
                              max={targetInvoice.items[idx]?.quantity}
                              value={item.quantity}
                              onChange={e => updateReturnItem(idx, "quantity", Number(e.target.value))}
                              className="w-24 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-2 text-orange-700 dark:text-orange-300 font-medium">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-3 font-semibold text-gray-700 dark:text-slate-300">إجمالي المرتجع:</td>
                        <td className="pt-3 font-bold text-orange-700 dark:text-orange-300">{formatCurrency(returnItems.reduce((s, i) => s + i.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Credit return */}
            {returnType === "credit" && (
              <Input
                label="مبلغ الفرق / الكريدت (جنيه)"
                type="number"
                min={0}
                value={creditAmount}
                onChange={e => setCreditAmount(Number(e.target.value))}
              />
            )}

            <Input label="تاريخ المرتجع" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            <Input label="ملاحظة" value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="سبب الإرجاع..." />

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReturnModal(false)}>إلغاء</Button>
              <Button onClick={handleReturn} loading={loading}>تأكيد المرتجع</Button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
