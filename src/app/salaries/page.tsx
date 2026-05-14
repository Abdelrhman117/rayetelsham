"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getEmployees,
  getSalaryRecords,
  setSalaryRecord,
  getDeductions,
  addDeduction,
  deleteDeduction,
  getAdvances,
  addAdvance,
  deleteAdvance,
  repayAdvance,
} from "@/lib/firestore";
import { formatCurrency, todayString } from "@/lib/utils";
import { Employee, SalaryRecord, Deduction, Advance } from "@/types";
import { toast } from "sonner";

const DEDUCTION_REASONS = ["غياب", "تأخير", "خطأ في العمل", "كسر/تلف", "مخالفة", "خصم سلفة", "أخرى"];
const ADVANCE_REASONS = ["ظروف شخصية", "علاج طبي", "مصاريف عائلية", "سفر", "زواج", "أخرى"];

export default function SalariesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [tab, setTab] = useState<"daily" | "history" | "deductions" | "advances">("daily");
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [attendance, setAttendance] = useState<Record<string, { worked: boolean; paid: boolean }>>({});

  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [historyEnd, setHistoryEnd] = useState(todayString());

  // Deductions state
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionForm, setDeductionForm] = useState({
    employeeId: "",
    date: todayString(),
    amount: "",
    reason: DEDUCTION_REASONS[0],
    note: "",
  });

  // Advances state
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    employeeId: "",
    date: todayString(),
    amount: "",
    reason: ADVANCE_REASONS[0],
    note: "",
  });
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [repayForm, setRepayForm] = useState({ amount: "", date: todayString(), note: "" });

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => { loadDailyRecords(); }, [selectedDate, employees]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, historyStart, historyEnd]);
  useEffect(() => { if (tab === "deductions") loadDeductions(); }, [tab]);
  useEffect(() => { if (tab === "advances") loadAdvances(); }, [tab]);

  async function loadEmployees() {
    const emps = await getEmployees();
    setEmployees(emps as Employee[]);
  }

  async function loadDailyRecords() {
    if (!employees.length) return;
    const recs = await getSalaryRecords(selectedDate);
    const initial: Record<string, { worked: boolean; paid: boolean }> = {};
    for (const emp of employees) {
      const rec = (recs as SalaryRecord[]).find((r) => r.employeeId === emp.id);
      initial[emp.id] = { worked: rec ? true : false, paid: rec?.paid || false };
    }
    setAttendance(initial);
  }

  async function loadHistory() {
    const recs = await getSalaryRecords();
    const filtered = (recs as SalaryRecord[]).filter(
      (r) => r.date >= historyStart && r.date <= historyEnd
    );
    setRecords(filtered);
  }

  async function loadDeductions() {
    const data = await getDeductions();
    setDeductions(data as Deduction[]);
  }

  async function loadAdvances() {
    const data = await getAdvances();
    setAdvances(data as Advance[]);
  }

  function toggle(empId: string, field: "worked" | "paid") {
    setAttendance((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: !prev[empId][field] },
    }));
  }

  const dailyTotal = employees
    .filter((e) => attendance[e.id]?.worked)
    .reduce((s, e) => s + e.dailyWage, 0);

  async function handleSave() {
    setLoading(true);
    try {
      await Promise.all(
        employees
          .filter((e) => attendance[e.id]?.worked)
          .map((emp) =>
            setSalaryRecord(selectedDate, emp.id, {
              employeeName: emp.name,
              dailyWage: emp.dailyWage,
              paid: attendance[emp.id]?.paid || false,
            })
          )
      );
      toast.success("تم حفظ الحضور");
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDeduction() {
    if (!deductionForm.employeeId || !deductionForm.amount) {
      toast.error("الرجاء تعبئة جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const emp = employees.find((e) => e.id === deductionForm.employeeId);
      await addDeduction({
        employeeId: deductionForm.employeeId,
        employeeName: emp?.name || "",
        date: deductionForm.date,
        amount: Number(deductionForm.amount),
        reason: deductionForm.reason,
        note: deductionForm.note,
      });
      toast.success("تم إضافة الخصم");
      setShowDeductionModal(false);
      setDeductionForm({ employeeId: "", date: todayString(), amount: "", reason: DEDUCTION_REASONS[0], note: "" });
      loadDeductions();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDeduction(id: string) {
    if (!confirm("هل تريد حذف هذا الخصم؟")) return;
    try {
      await deleteDeduction(id);
      toast.success("تم حذف الخصم");
      loadDeductions();
    } catch {
      toast.error("حدث خطأ");
    }
  }

  async function handleAddAdvance() {
    if (!advanceForm.employeeId || !advanceForm.amount) {
      toast.error("الرجاء تعبئة جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const emp = employees.find((e) => e.id === advanceForm.employeeId);
      await addAdvance({
        employeeId: advanceForm.employeeId,
        employeeName: emp?.name || "",
        date: advanceForm.date,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason,
        note: advanceForm.note,
      });
      toast.success("تم إضافة السلفة");
      setShowAdvanceModal(false);
      setAdvanceForm({ employeeId: "", date: todayString(), amount: "", reason: ADVANCE_REASONS[0], note: "" });
      loadAdvances();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAdvance(id: string) {
    if (!confirm("هل تريد حذف هذه السلفة؟")) return;
    try {
      await deleteAdvance(id);
      toast.success("تم حذف السلفة");
      loadAdvances();
    } catch {
      toast.error("حدث خطأ");
    }
  }

  async function handleRepay() {
    if (!selectedAdvance || !repayForm.amount) {
      toast.error("أدخل المبلغ");
      return;
    }
    const remaining = selectedAdvance.amount - selectedAdvance.repaidAmount;
    if (Number(repayForm.amount) > remaining) {
      toast.error("المبلغ أكبر من المتبقي");
      return;
    }
    setLoading(true);
    try {
      await repayAdvance(selectedAdvance.id, Number(repayForm.amount), repayForm.date, repayForm.note);
      toast.success("تم تسجيل السداد");
      setShowRepayModal(false);
      setRepayForm({ amount: "", date: todayString(), note: "" });
      setSelectedAdvance(null);
      loadAdvances();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const historyTotal = records.reduce((s, r) => s + (r.dailyWage || 0), 0);
  const historyPaid = records.filter((r) => r.paid).reduce((s, r) => s + (r.dailyWage || 0), 0);

  const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
  const activeAdvances = advances.filter((a) => a.status !== "repaid");
  const advanceTotal = advances.reduce((s, a) => s + a.amount, 0);
  const advanceRemaining = advances.reduce((s, a) => s + (a.amount - a.repaidAmount), 0);

  const tabs = [
    { key: "daily", label: "سجل الحضور اليومي" },
    { key: "history", label: "تقرير الرواتب" },
    { key: "deductions", label: "الخصومات" },
    { key: "advances", label: "السلف" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">الرواتب والحضور</h1>

        <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-amber-700 text-amber-700 dark:text-amber-400 dark:border-amber-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== DAILY ATTENDANCE ===== */}
        {tab === "daily" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Input
                label="التاريخ"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44"
              />
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2 text-sm">
                <span className="text-amber-700 dark:text-amber-300 font-medium">إجمالي رواتب اليوم: </span>
                <span className="font-bold text-amber-800 dark:text-amber-200">{formatCurrency(dailyTotal)}</span>
              </div>
            </div>

            {employees.length > 0 ? (
              <Card title={`كشف الحضور — ${selectedDate}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                        <th className="pb-2 font-medium text-right">الموظف</th>
                        <th className="pb-2 font-medium text-right">الدور</th>
                        <th className="pb-2 font-medium text-right">الأجر اليومي</th>
                        <th className="pb-2 font-medium text-center">حضر</th>
                        <th className="pb-2 font-medium text-center">مدفوع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className={`border-b border-gray-50 dark:border-slate-700 ${attendance[emp.id]?.worked ? "bg-green-50/50 dark:bg-green-900/10" : ""}`}>
                          <td className="py-3 font-medium text-gray-900 dark:text-slate-100">{emp.name}</td>
                          <td className="py-3 text-gray-500 dark:text-slate-400">{emp.role}</td>
                          <td className="py-3 text-amber-700 dark:text-amber-300 font-medium">{formatCurrency(emp.dailyWage)}</td>
                          <td className="py-3 text-center">
                            <input
                              type="checkbox"
                              checked={attendance[emp.id]?.worked || false}
                              onChange={() => toggle(emp.id, "worked")}
                              className="w-5 h-5 rounded accent-amber-700 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 text-center">
                            <input
                              type="checkbox"
                              checked={attendance[emp.id]?.paid || false}
                              onChange={() => toggle(emp.id, "paid")}
                              disabled={!attendance[emp.id]?.worked}
                              className="w-5 h-5 rounded accent-green-600 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="pt-3 font-semibold text-gray-700 dark:text-slate-300">
                          {employees.filter((e) => attendance[e.id]?.worked).length} من {employees.length} موظفين
                        </td>
                        <td className="pt-3 font-bold text-amber-700 dark:text-amber-300">{formatCurrency(dailyTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-4">
                  <Button onClick={handleSave} loading={loading}>حفظ الحضور</Button>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-gray-400 dark:text-slate-500 text-center py-4">
                  لا يوجد موظفون. أضفهم من صفحة <a href="/settings" className="text-amber-700 hover:underline">الإعدادات</a>.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* ===== SALARY HISTORY ===== */}
        {tab === "history" && (
          <div className="space-y-4">
            <Card title="فترة التقرير">
              <div className="flex gap-3 flex-wrap items-end">
                <Input label="من" type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="w-40" />
                <Input label="إلى" type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="w-40" />
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">إجمالي الرواتب</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(historyTotal)}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">المدفوع</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">{formatCurrency(historyPaid)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">غير مدفوع</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{formatCurrency(historyTotal - historyPaid)}</p>
              </div>
            </div>

            <Card title="تفاصيل الرواتب">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                      <th className="pb-2 font-medium text-right">التاريخ</th>
                      <th className="pb-2 font-medium text-right">الموظف</th>
                      <th className="pb-2 font-medium text-right">الأجر</th>
                      <th className="pb-2 font-medium text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="py-2 text-gray-700 dark:text-slate-300">{r.date}</td>
                        <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{r.employeeName}</td>
                        <td className="py-2 text-amber-700 dark:text-amber-300">{formatCurrency(r.dailyWage)}</td>
                        <td className="py-2">
                          {r.paid ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">مدفوع</span>
                          ) : (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">مستحق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!records.length && (
                      <tr><td colSpan={4} className="text-center text-gray-400 dark:text-slate-500 py-6">لا توجد سجلات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ===== DEDUCTIONS ===== */}
        {tab === "deductions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2 text-sm">
                  <span className="text-red-700 dark:text-red-300 font-medium">إجمالي الخصومات: </span>
                  <span className="font-bold text-red-800 dark:text-red-200">{formatCurrency(deductionTotal)}</span>
                </div>
              </div>
              <Button onClick={() => setShowDeductionModal(true)}>+ إضافة خصم</Button>
            </div>

            <Card title="سجل الخصومات">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                      <th className="pb-2 font-medium text-right">التاريخ</th>
                      <th className="pb-2 font-medium text-right">الموظف</th>
                      <th className="pb-2 font-medium text-right">المبلغ</th>
                      <th className="pb-2 font-medium text-right">السبب</th>
                      <th className="pb-2 font-medium text-right">ملاحظة</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductions.map((d) => (
                      <tr key={d.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="py-2 text-gray-700 dark:text-slate-300">{d.date}</td>
                        <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{d.employeeName}</td>
                        <td className="py-2 text-red-700 dark:text-red-300 font-medium">{formatCurrency(d.amount)}</td>
                        <td className="py-2 text-gray-600 dark:text-slate-400">{d.reason}</td>
                        <td className="py-2 text-gray-500 dark:text-slate-500 text-xs">{d.note}</td>
                        <td className="py-2">
                          <button onClick={() => handleDeleteDeduction(d.id)} className="text-red-500 hover:text-red-700 text-xs">حذف</button>
                        </td>
                      </tr>
                    ))}
                    {!deductions.length && (
                      <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-500 py-6">لا توجد خصومات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ===== ADVANCES ===== */}
        {tab === "advances" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-3 flex-wrap">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-4 py-2 text-sm">
                  <span className="text-orange-700 dark:text-orange-300 font-medium">إجمالي السلف: </span>
                  <span className="font-bold text-orange-800 dark:text-orange-200">{formatCurrency(advanceTotal)}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2 text-sm">
                  <span className="text-red-700 dark:text-red-300 font-medium">المتبقي: </span>
                  <span className="font-bold text-red-800 dark:text-red-200">{formatCurrency(advanceRemaining)}</span>
                </div>
              </div>
              <Button onClick={() => setShowAdvanceModal(true)}>+ إضافة سلفة</Button>
            </div>

            <Card title="سجل السلف">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                      <th className="pb-2 font-medium text-right">التاريخ</th>
                      <th className="pb-2 font-medium text-right">الموظف</th>
                      <th className="pb-2 font-medium text-right">المبلغ</th>
                      <th className="pb-2 font-medium text-right">المسدد</th>
                      <th className="pb-2 font-medium text-right">المتبقي</th>
                      <th className="pb-2 font-medium text-right">السبب</th>
                      <th className="pb-2 font-medium text-right">الحالة</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map((a) => {
                      const remaining = a.amount - a.repaidAmount;
                      return (
                        <tr key={a.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                          <td className="py-2 text-gray-700 dark:text-slate-300">{a.date}</td>
                          <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{a.employeeName}</td>
                          <td className="py-2 text-orange-700 dark:text-orange-300 font-medium">{formatCurrency(a.amount)}</td>
                          <td className="py-2 text-green-700 dark:text-green-300">{formatCurrency(a.repaidAmount)}</td>
                          <td className="py-2 text-red-700 dark:text-red-300 font-medium">{formatCurrency(remaining)}</td>
                          <td className="py-2 text-gray-600 dark:text-slate-400">{a.reason}</td>
                          <td className="py-2">
                            {a.status === "repaid" ? (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">مسدد</span>
                            ) : a.status === "partial" ? (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">جزئي</span>
                            ) : (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">نشطة</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              {a.status !== "repaid" && (
                                <button
                                  onClick={() => { setSelectedAdvance(a); setShowRepayModal(true); }}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-xs"
                                >
                                  سداد
                                </button>
                              )}
                              <button onClick={() => handleDeleteAdvance(a.id)} className="text-red-500 hover:text-red-700 text-xs">حذف</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!advances.length && (
                      <tr><td colSpan={8} className="text-center text-gray-400 dark:text-slate-500 py-6">لا توجد سلف</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ===== DEDUCTION MODAL ===== */}
      {showDeductionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">إضافة خصم</h2>
              <button onClick={() => setShowDeductionModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">الموظف *</label>
                <select
                  value={deductionForm.employeeId}
                  onChange={(e) => setDeductionForm({ ...deductionForm, employeeId: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  <option value="">اختر موظف</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <Input
                label="التاريخ *"
                type="date"
                value={deductionForm.date}
                onChange={(e) => setDeductionForm({ ...deductionForm, date: e.target.value })}
              />
              <Input
                label="المبلغ (جنيه) *"
                type="number"
                value={deductionForm.amount}
                onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                placeholder="0"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">السبب *</label>
                <select
                  value={deductionForm.reason}
                  onChange={(e) => setDeductionForm({ ...deductionForm, reason: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  {DEDUCTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Input
                label="ملاحظة"
                value={deductionForm.note}
                onChange={(e) => setDeductionForm({ ...deductionForm, note: e.target.value })}
                placeholder="اختياري"
              />
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeductionModal(false)}>إلغاء</Button>
              <Button onClick={handleAddDeduction} loading={loading}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADVANCE MODAL ===== */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">إضافة سلفة</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">الموظف *</label>
                <select
                  value={advanceForm.employeeId}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  <option value="">اختر موظف</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <Input
                label="التاريخ *"
                type="date"
                value={advanceForm.date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
              />
              <Input
                label="مبلغ السلفة (جنيه) *"
                type="number"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                placeholder="0"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">السبب *</label>
                <select
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  {ADVANCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Input
                label="ملاحظة"
                value={advanceForm.note}
                onChange={(e) => setAdvanceForm({ ...advanceForm, note: e.target.value })}
                placeholder="اختياري"
              />
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowAdvanceModal(false)}>إلغاء</Button>
              <Button onClick={handleAddAdvance} loading={loading}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REPAY MODAL ===== */}
      {showRepayModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">تسجيل سداد سلفة</h2>
              <button onClick={() => { setShowRepayModal(false); setSelectedAdvance(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-slate-400">الموظف:</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{selectedAdvance.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-slate-400">مبلغ السلفة:</span>
                  <span className="font-medium text-orange-700 dark:text-orange-300">{formatCurrency(selectedAdvance.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-slate-400">المسدد:</span>
                  <span className="font-medium text-green-700 dark:text-green-300">{formatCurrency(selectedAdvance.repaidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-slate-600 pt-1 mt-1">
                  <span className="text-gray-700 dark:text-slate-300 font-medium">المتبقي:</span>
                  <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(selectedAdvance.amount - selectedAdvance.repaidAmount)}</span>
                </div>
              </div>
              <Input
                label="مبلغ السداد (جنيه) *"
                type="number"
                value={repayForm.amount}
                onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                placeholder="0"
              />
              <Input
                label="التاريخ *"
                type="date"
                value={repayForm.date}
                onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })}
              />
              <Input
                label="ملاحظة"
                value={repayForm.note}
                onChange={(e) => setRepayForm({ ...repayForm, note: e.target.value })}
                placeholder="اختياري"
              />
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setShowRepayModal(false); setSelectedAdvance(null); }}>إلغاء</Button>
              <Button onClick={handleRepay} loading={loading}>تأكيد السداد</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
