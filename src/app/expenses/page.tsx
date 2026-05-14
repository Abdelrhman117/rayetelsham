"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { getExpenses, addExpense, updateExpense, deleteExpense } from "@/lib/firestore";
import { formatCurrency, todayString, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/utils";
import { Expense } from "@/types";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#b45309", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const today = todayString();
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [filterEnd, setFilterEnd] = useState(today);
  const [filterCategory, setFilterCategory] = useState("");

  const [form, setForm] = useState({
    date: today,
    category: "أخرى",
    amount: 0,
    paymentMethod: "نقد",
    note: "",
  });

  useEffect(() => { loadExpenses(); }, [filterStart, filterEnd]);

  async function loadExpenses() {
    const data = await getExpenses(filterStart, filterEnd);
    setExpenses(data as Expense[]);
  }

  function openAdd() {
    setEditExpense(null);
    setForm({ date: today, category: "أخرى", amount: 0, paymentMethod: "نقد", note: "" });
    setModal(true);
  }

  function openEdit(exp: Expense) {
    setEditExpense(exp);
    setForm({
      date: exp.date,
      category: exp.category,
      amount: exp.amount,
      paymentMethod: exp.paymentMethod,
      note: exp.note,
    });
    setModal(true);
  }

  async function handleSave() {
    if (!form.amount || form.amount <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    setLoading(true);
    try {
      if (editExpense) {
        await updateExpense(editExpense.id, form);
        toast.success("تم التحديث");
      } else {
        await addExpense(form);
        toast.success("تم تسجيل المصروف");
      }
      setModal(false);
      loadExpenses();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await deleteExpense(id);
    toast.success("تم الحذف");
    loadExpenses();
  }

  const filtered = filterCategory
    ? expenses.filter((e) => e.category === filterCategory)
    : expenses;
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  // Pie chart data by category
  const byCategory: Record<string, number> = {};
  for (const exp of expenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">المصروفات والإيجارات</h1>
          <Button onClick={openAdd}>+ تسجيل مصروف</Button>
        </div>

        {/* Filters */}
        <Card title="فلترة">
          <div className="flex gap-3 flex-wrap items-end">
            <Input label="من" type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-40" />
            <Input label="إلى" type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-40" />
            <Select label="التصنيف" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-48">
              <option value="">جميع التصنيفات</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <span className="font-medium text-red-700">إجمالي المصروفات ({filterCategory || "جميع التصنيفات"})</span>
              <span className="text-xl font-bold text-red-700">{formatCurrency(total)}</span>
            </div>

            <Card title={`المصروفات (${filtered.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                      <th className="pb-2 font-medium">التاريخ</th>
                      <th className="pb-2 font-medium">التصنيف</th>
                      <th className="pb-2 font-medium">المبلغ</th>
                      <th className="pb-2 font-medium">طريقة الدفع</th>
                      <th className="pb-2 font-medium">ملاحظة</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                        <td className="py-2">{exp.date}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-2 font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                        <td className="py-2 text-gray-500 dark:text-slate-500">{exp.paymentMethod}</td>
                        <td className="py-2 text-gray-400 dark:text-slate-600 text-xs max-w-xs truncate">{exp.note}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(exp)} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                            <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-600 py-6">لا توجد مصروفات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {pieData.length > 0 && (
            <Card title="توزيع المصروفات">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editExpense ? "تعديل مصروف" : "تسجيل مصروف جديد"} size="sm">
        <div className="space-y-4">
          <Input label="التاريخ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="التصنيف" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="المبلغ" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <Select label="طريقة الدفع" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>إلغاء</Button>
            <Button onClick={handleSave} loading={loading}>{editExpense ? "تحديث" : "حفظ"}</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
