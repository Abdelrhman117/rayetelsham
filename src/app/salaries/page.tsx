"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
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
  getBonuses,
  addBonus,
  deleteBonus,
} from "@/lib/firestore";
import { formatCurrency, todayString } from "@/lib/utils";
import { Employee, SalaryRecord, Deduction, Advance, Bonus } from "@/types";
import { toast } from "sonner";
import { Printer } from "lucide-react";

const DEDUCTION_REASONS = ["غياب", "تأخير", "خطأ في العمل", "كسر/تلف", "مخالفة", "خصم سلفة", "أخرى"];
const ADVANCE_REASONS  = ["ظروف شخصية", "علاج طبي", "مصاريف عائلية", "سفر", "زواج", "أخرى"];
const BONUS_REASONS    = ["أداء متميز", "عمل إضافي", "مناسبة خاصة", "رمضان", "عيد", "إنجاز مشروع", "أخرى"];

type Tab = "daily" | "history" | "deductions" | "advances" | "bonuses" | "monthly";

const TABS: { key: Tab; label: string }[] = [
  { key: "daily",      label: "الحضور اليومي" },
  { key: "history",    label: "سجل الرواتب"   },
  { key: "deductions", label: "الخصومات"       },
  { key: "advances",   label: "السلف"          },
  { key: "bonuses",    label: "المكافآت"       },
  { key: "monthly",    label: "تقرير شهري"     },
];

export default function SalariesPage() {
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [records,      setRecords]      = useState<SalaryRecord[]>([]);
  const [tab,          setTab]          = useState<Tab>("daily");
  const [loading,      setLoading]      = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [attendance,   setAttendance]   = useState<Record<string, { worked: boolean; paid: boolean }>>({});

  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [historyEnd, setHistoryEnd] = useState(todayString());

  // Deductions
  const [deductions,         setDeductions]         = useState<Deduction[]>([]);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionForm,      setDeductionForm]      = useState({ employeeId: "", date: todayString(), amount: "", reason: DEDUCTION_REASONS[0], note: "" });

  // Advances
  const [advances,         setAdvances]         = useState<Advance[]>([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm,      setAdvanceForm]      = useState({ employeeId: "", date: todayString(), amount: "", reason: ADVANCE_REASONS[0], note: "" });
  const [showRepayModal,   setShowRepayModal]   = useState(false);
  const [selectedAdvance,  setSelectedAdvance]  = useState<Advance | null>(null);
  const [repayForm,        setRepayForm]        = useState({ amount: "", date: todayString(), note: "" });

  // Bonuses
  const [bonuses,         setBonuses]         = useState<Bonus[]>([]);
  const [showBonusModal,  setShowBonusModal]  = useState(false);
  const [bonusForm,       setBonusForm]       = useState({ employeeId: "", date: todayString(), amount: "", reason: BONUS_REASONS[0], note: "" });

  // Monthly report
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportData, setReportData] = useState<{
    employee: Employee;
    daysWorked: number;
    totalWages: number;
    totalDeductions: number;
    totalBonuses: number;
    totalAdvances: number;
    net: number;
  }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => { loadDailyRecords(); }, [selectedDate, employees]);
  useEffect(() => { if (tab === "history")    loadHistory();    }, [tab, historyStart, historyEnd]);
  useEffect(() => { if (tab === "deductions") loadDeductions(); }, [tab]);
  useEffect(() => { if (tab === "advances")   loadAdvances();   }, [tab]);
  useEffect(() => { if (tab === "bonuses")    loadBonuses();    }, [tab]);
  useEffect(() => { if (tab === "monthly")    buildReport();    }, [tab, reportMonth, employees]);

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
      initial[emp.id] = { worked: !!rec, paid: rec?.paid || false };
    }
    setAttendance(initial);
  }

  async function loadHistory() {
    const recs = await getSalaryRecords();
    const filtered = (recs as SalaryRecord[]).filter((r) => r.date >= historyStart && r.date <= historyEnd);
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

  async function loadBonuses() {
    const data = await getBonuses();
    setBonuses(data as Bonus[]);
  }

  async function buildReport() {
    if (!employees.length) return;
    setReportLoading(true);
    try {
      const [year, month] = reportMonth.split("-").map(Number);
      const start = `${reportMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${reportMonth}-${String(lastDay).padStart(2, "0")}`;

      const [allRecs, allDeductions, allBonuses, allAdvances] = await Promise.all([
        getSalaryRecords(),
        getDeductions(),
        getBonuses(),
        getAdvances(),
      ]);

      const monthRecs        = (allRecs        as SalaryRecord[]).filter((r) => r.date >= start && r.date <= end);
      const monthDeductions  = (allDeductions  as Deduction[]).filter((d) => d.date >= start && d.date <= end);
      const monthBonuses     = (allBonuses     as Bonus[]).filter((b) => b.date >= start && b.date <= end);
      const monthAdvances    = (allAdvances    as Advance[]).filter((a) => a.date >= start && a.date <= end);

      const data = employees.map((emp) => {
        const empRecs       = monthRecs.filter((r) => r.employeeId === emp.id);
        const empDeductions = monthDeductions.filter((d) => d.employeeId === emp.id);
        const empBonuses    = monthBonuses.filter((b) => b.employeeId === emp.id);
        const empAdvances   = monthAdvances.filter((a) => a.employeeId === emp.id);

        const daysWorked      = empRecs.length;
        const totalWages      = empRecs.reduce((s, r) => s + (r.dailyWage || 0), 0);
        const totalDeductions = empDeductions.reduce((s, d) => s + (d.amount || 0), 0);
        const totalBonuses    = empBonuses.reduce((s, b) => s + (b.amount || 0), 0);
        const totalAdvances   = empAdvances.reduce((s, a) => s + (a.amount || 0), 0);
        const net = totalWages - totalDeductions + totalBonuses - totalAdvances;

        return { employee: emp, daysWorked, totalWages, totalDeductions, totalBonuses, totalAdvances, net };
      });

      setReportData(data);
    } finally {
      setReportLoading(false);
    }
  }

  async function handleToggleAttendance(empId: string) {
    const curr = attendance[empId] || { worked: false, paid: false };
    const newWorked = !curr.worked;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setAttendance((prev) => ({ ...prev, [empId]: { ...curr, worked: newWorked } }));
    await setSalaryRecord(selectedDate, empId, {
      employeeName: emp.name,
      dailyWage: emp.dailyWage,
      paid: newWorked ? curr.paid : false,
    }, newWorked);
  }

  async function handleTogglePaid(empId: string) {
    const curr = attendance[empId] || { worked: false, paid: false };
    if (!curr.worked) return;
    const newPaid = !curr.paid;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setAttendance((prev) => ({ ...prev, [empId]: { ...curr, paid: newPaid } }));
    await setSalaryRecord(selectedDate, empId, {
      employeeName: emp.name,
      dailyWage: emp.dailyWage,
      paid: newPaid,
    }, true);
  }

  async function handleSaveDeduction() {
    if (!deductionForm.employeeId) { toast.error("اختر موظفاً"); return; }
    if (!deductionForm.amount || Number(deductionForm.amount) <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setLoading(true);
    try {
      const emp = employees.find((e) => e.id === deductionForm.employeeId);
      await addDeduction({ ...deductionForm, amount: Number(deductionForm.amount), employeeName: emp?.name || "" });
      toast.success("تم إضافة الخصم");
      setShowDeductionModal(false);
      setDeductionForm({ employeeId: "", date: todayString(), amount: "", reason: DEDUCTION_REASONS[0], note: "" });
      loadDeductions();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleSaveAdvance() {
    if (!advanceForm.employeeId) { toast.error("اختر موظفاً"); return; }
    if (!advanceForm.amount || Number(advanceForm.amount) <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setLoading(true);
    try {
      const emp = employees.find((e) => e.id === advanceForm.employeeId);
      await addAdvance({ ...advanceForm, amount: Number(advanceForm.amount), employeeName: emp?.name || "" });
      toast.success("تم تسجيل السلفة");
      setShowAdvanceModal(false);
      setAdvanceForm({ employeeId: "", date: todayString(), amount: "", reason: ADVANCE_REASONS[0], note: "" });
      loadAdvances();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleRepayAdvance() {
    if (!selectedAdvance) return;
    if (!repayForm.amount || Number(repayForm.amount) <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setLoading(true);
    try {
      await repayAdvance(selectedAdvance.id, Number(repayForm.amount), repayForm.date, repayForm.note);
      toast.success("تم تسجيل السداد");
      setShowRepayModal(false);
      setRepayForm({ amount: "", date: todayString(), note: "" });
      loadAdvances();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleSaveBonus() {
    if (!bonusForm.employeeId) { toast.error("اختر موظفاً"); return; }
    if (!bonusForm.amount || Number(bonusForm.amount) <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setLoading(true);
    try {
      const emp = employees.find((e) => e.id === bonusForm.employeeId);
      await addBonus({ ...bonusForm, amount: Number(bonusForm.amount), employeeName: emp?.name || "" });
      toast.success("تم إضافة المكافأة");
      setShowBonusModal(false);
      setBonusForm({ employeeId: "", date: todayString(), amount: "", reason: BONUS_REASONS[0], note: "" });
      loadBonuses();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  function printMonthlyReport() {
    const [year, month] = reportMonth.split("-").map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleDateString("ar-EG", { year: "numeric", month: "long" });
    const rows = reportData.map((row) => `
      <tr>
        <td>${row.employee.name}</td>
        <td>${row.employee.role}</td>
        <td>${row.daysWorked}</td>
        <td>${row.totalWages.toLocaleString("ar-EG")} ج.م</td>
        <td style="color:#dc2626">${row.totalDeductions.toLocaleString("ar-EG")} ج.م</td>
        <td style="color:#059669">${row.totalBonuses.toLocaleString("ar-EG")} ج.م</td>
        <td style="color:#d97706">${row.totalAdvances.toLocaleString("ar-EG")} ج.م</td>
        <td style="font-weight:bold;color:${row.net >= 0 ? "#065f46" : "#dc2626"}">${row.net.toLocaleString("ar-EG")} ج.م</td>
      </tr>`).join("");

    const totalNet = reportData.reduce((s, r) => s + r.net, 0);

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>تقرير رواتب ${monthName}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1a1a1a; direction: rtl; }
  h1 { color: #92400e; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #92400e; color: white; padding: 10px 12px; text-align: right; }
  td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafaf9; }
  .total-row td { background: #fef3c7 !important; font-weight: bold; border-top: 2px solid #92400e; }
  .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style></head>
<body>
  <h1>تقرير الرواتب الشهري</h1>
  <p class="subtitle">الفترة: ${monthName} — تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}</p>
  <table>
    <thead><tr><th>الموظف</th><th>الدور</th><th>أيام العمل</th><th>الراتب</th><th>الخصومات</th><th>المكافآت</th><th>السلف</th><th>الصافي</th></tr></thead>
    <tbody>${rows}
      <tr class="total-row">
        <td colspan="7">الإجمالي</td>
        <td>${totalNet.toLocaleString("ar-EG")} ج.م</td>
      </tr>
    </tbody>
  </table>
  <div class="footer"><p>راية الشام — نظام إدارة المطعم</p></div>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 400);
  }

  const advanceStatusMap: Record<string, string> = { active: "نشطة", partial: "جزئي", repaid: "مسددة" };
  const advanceStatusColor: Record<string, string> = {
    active:  "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400",
    partial: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400",
    repaid:  "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">الرواتب</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-yellow-500 text-yellow-600 dark:text-yellow-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DAILY ATTENDANCE TAB ── */}
        {tab === "daily" && (
          <Card title="الحضور اليومي" actions={
            <input type="date" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          }>
            <div className="space-y-2">
              {employees.map((emp) => {
                const att = attendance[emp.id] || { worked: false, paid: false };
                return (
                  <div key={emp.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    att.worked
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                      : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"
                  }`}>
                    <button
                      onClick={() => handleToggleAttendance(emp.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                        att.worked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 dark:border-slate-600"
                      }`}
                    >
                      {att.worked && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-slate-100">{emp.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{emp.role} · {formatCurrency(emp.dailyWage)}</p>
                    </div>
                    {att.worked && (
                      <button
                        onClick={() => handleTogglePaid(emp.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          att.paid
                            ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                        }`}
                      >
                        {att.paid ? "✓ مدفوع" : "تحديد كمدفوع"}
                      </button>
                    )}
                  </div>
                );
              })}
              {!employees.length && (
                <p className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">
                  لا يوجد موظفون. أضف موظفين من صفحة الإعدادات.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <Card title="سجل الحضور والرواتب" actions={
            <div className="flex gap-2 items-center">
              <input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)}
                className="border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <span className="text-gray-400 text-xs">—</span>
              <input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)}
                className="border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="pb-2 font-medium text-right">التاريخ</th>
                    <th className="pb-2 font-medium text-right">الموظف</th>
                    <th className="pb-2 font-medium text-right">الأجر اليومي</th>
                    <th className="pb-2 font-medium text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 font-mono text-xs">{rec.date}</td>
                      <td className="py-2.5 font-medium text-gray-900 dark:text-slate-100">{rec.employeeName}</td>
                      <td className="py-2.5 text-amber-700 dark:text-amber-300">{formatCurrency(rec.dailyWage)}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rec.paid
                            ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                        }`}>{rec.paid ? "مدفوع" : "غير مدفوع"}</span>
                      </td>
                    </tr>
                  ))}
                  {!records.length && (
                    <tr><td colSpan={4} className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">لا توجد سجلات في هذه الفترة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── DEDUCTIONS TAB ── */}
        {tab === "deductions" && (
          <Card title={`الخصومات (${deductions.length})`} actions={
            <Button size="sm" onClick={() => setShowDeductionModal(true)}>+ خصم جديد</Button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
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
                    <tr key={d.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 font-mono text-xs">{d.date}</td>
                      <td className="py-2.5 font-medium text-gray-900 dark:text-slate-100">{d.employeeName}</td>
                      <td className="py-2.5 text-red-600 dark:text-red-400 font-medium">{formatCurrency(d.amount)}</td>
                      <td className="py-2.5"><span className="text-xs bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">{d.reason}</span></td>
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 text-xs">{d.note}</td>
                      <td className="py-2.5">
                        <button onClick={async () => { await deleteDeduction(d.id); loadDeductions(); toast.success("تم الحذف"); }}
                          className="text-xs text-red-500 hover:underline">حذف</button>
                      </td>
                    </tr>
                  ))}
                  {!deductions.length && (
                    <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">لا توجد خصومات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── ADVANCES TAB ── */}
        {tab === "advances" && (
          <Card title={`السلف (${advances.length})`} actions={
            <Button size="sm" onClick={() => setShowAdvanceModal(true)}>+ سلفة جديدة</Button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="pb-2 font-medium text-right">التاريخ</th>
                    <th className="pb-2 font-medium text-right">الموظف</th>
                    <th className="pb-2 font-medium text-right">المبلغ</th>
                    <th className="pb-2 font-medium text-right">المسدد</th>
                    <th className="pb-2 font-medium text-right">الحالة</th>
                    <th className="pb-2 font-medium text-right">السبب</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((adv) => (
                    <tr key={adv.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 font-mono text-xs">{adv.date}</td>
                      <td className="py-2.5 font-medium text-gray-900 dark:text-slate-100">{adv.employeeName}</td>
                      <td className="py-2.5 text-amber-700 dark:text-amber-300 font-medium">{formatCurrency(adv.amount)}</td>
                      <td className="py-2.5 text-emerald-600 dark:text-emerald-400">{formatCurrency(adv.repaidAmount || 0)}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${advanceStatusColor[adv.status]}`}>
                          {advanceStatusMap[adv.status]}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 text-xs">{adv.reason}</td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          {adv.status !== "repaid" && (
                            <button onClick={() => { setSelectedAdvance(adv); setShowRepayModal(true); }}
                              className="text-xs text-blue-600 hover:underline">سداد</button>
                          )}
                          <button onClick={async () => { await deleteAdvance(adv.id); loadAdvances(); toast.success("تم الحذف"); }}
                            className="text-xs text-red-500 hover:underline">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!advances.length && (
                    <tr><td colSpan={7} className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">لا توجد سلف</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── BONUSES TAB ── */}
        {tab === "bonuses" && (
          <Card title={`المكافآت (${bonuses.length})`} actions={
            <Button size="sm" onClick={() => setShowBonusModal(true)}>+ مكافأة جديدة</Button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="pb-2 font-medium text-right">التاريخ</th>
                    <th className="pb-2 font-medium text-right">الموظف</th>
                    <th className="pb-2 font-medium text-right">المبلغ</th>
                    <th className="pb-2 font-medium text-right">السبب</th>
                    <th className="pb-2 font-medium text-right">ملاحظة</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 font-mono text-xs">{b.date}</td>
                      <td className="py-2.5 font-medium text-gray-900 dark:text-slate-100">{b.employeeName}</td>
                      <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(b.amount)}</td>
                      <td className="py-2.5"><span className="text-xs bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{b.reason}</span></td>
                      <td className="py-2.5 text-gray-500 dark:text-slate-400 text-xs">{b.note}</td>
                      <td className="py-2.5">
                        <button onClick={async () => { await deleteBonus(b.id); loadBonuses(); toast.success("تم الحذف"); }}
                          className="text-xs text-red-500 hover:underline">حذف</button>
                      </td>
                    </tr>
                  ))}
                  {!bonuses.length && (
                    <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">لا توجد مكافآت</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── MONTHLY REPORT TAB ── */}
        {tab === "monthly" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الشهر:</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <Button variant="outline" size="sm" onClick={printMonthlyReport}>
                <Printer className="w-4 h-4" />
                طباعة التقرير
              </Button>
            </div>

            {/* Summary cards */}
            {reportData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي الرواتب",  value: reportData.reduce((s,r)=>s+r.totalWages,0),      color: "text-amber-700 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40" },
                  { label: "إجمالي الخصومات", value: reportData.reduce((s,r)=>s+r.totalDeductions,0), color: "text-red-700 dark:text-red-300",         bg: "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40" },
                  { label: "إجمالي المكافآت", value: reportData.reduce((s,r)=>s+r.totalBonuses,0),    color: "text-emerald-700 dark:text-emerald-300",  bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40" },
                  { label: "صافي المستحق",    value: reportData.reduce((s,r)=>s+r.net,0),             color: "text-blue-700 dark:text-blue-300",        bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40" },
                ].map((card) => (
                  <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
                    <p className={`text-xs font-medium opacity-80 ${card.color}`}>{card.label}</p>
                    <p className={`text-xl font-bold mt-1 ${card.color}`}>{formatCurrency(card.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Per-employee breakdown */}
            <Card title="تفاصيل كل موظف">
              {reportLoading ? (
                <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">جاري التحميل...</div>
              ) : (
                <div className="space-y-3">
                  {reportData.map(({ employee, daysWorked, totalWages, totalDeductions, totalBonuses, totalAdvances, net }) => (
                    <div key={employee.id} className="rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-slate-100">{employee.name}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{employee.role} · {daysWorked} يوم عمل</p>
                        </div>
                        <div className={`text-lg font-bold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(net)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 text-center">
                          <p className="text-amber-600 dark:text-amber-400">الراتب</p>
                          <p className="font-bold text-amber-700 dark:text-amber-300 mt-0.5">{formatCurrency(totalWages)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-center">
                          <p className="text-red-500 dark:text-red-400">الخصومات</p>
                          <p className="font-bold text-red-700 dark:text-red-300 mt-0.5">- {formatCurrency(totalDeductions)}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-center">
                          <p className="text-emerald-600 dark:text-emerald-400">المكافآت</p>
                          <p className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">+ {formatCurrency(totalBonuses)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2 text-center">
                          <p className="text-orange-600 dark:text-orange-400">السلف</p>
                          <p className="font-bold text-orange-700 dark:text-orange-300 mt-0.5">- {formatCurrency(totalAdvances)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!reportData.length && (
                    <p className="text-center text-gray-400 dark:text-slate-600 py-8 text-sm">لا يوجد موظفون</p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ── DEDUCTION MODAL ── */}
      <Modal open={showDeductionModal} onClose={() => setShowDeductionModal(false)} title="إضافة خصم" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الموظف</label>
            <select value={deductionForm.employeeId} onChange={(e) => setDeductionForm({ ...deductionForm, employeeId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">اختر موظفاً</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <Input label="التاريخ" type="date" value={deductionForm.date} onChange={(e) => setDeductionForm({ ...deductionForm, date: e.target.value })} />
          <Input label="المبلغ (ج.م)" type="number" min={0} value={deductionForm.amount} onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">السبب</label>
            <select value={deductionForm.reason} onChange={(e) => setDeductionForm({ ...deductionForm, reason: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              {DEDUCTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="ملاحظة" value={deductionForm.note} onChange={(e) => setDeductionForm({ ...deductionForm, note: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowDeductionModal(false)}>إلغاء</Button>
            <Button onClick={handleSaveDeduction} loading={loading}>إضافة</Button>
          </div>
        </div>
      </Modal>

      {/* ── ADVANCE MODAL ── */}
      <Modal open={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} title="تسجيل سلفة" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الموظف</label>
            <select value={advanceForm.employeeId} onChange={(e) => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">اختر موظفاً</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <Input label="التاريخ" type="date" value={advanceForm.date} onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })} />
          <Input label="المبلغ (ج.م)" type="number" min={0} value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">السبب</label>
            <select value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              {ADVANCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="ملاحظة" value={advanceForm.note} onChange={(e) => setAdvanceForm({ ...advanceForm, note: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowAdvanceModal(false)}>إلغاء</Button>
            <Button onClick={handleSaveAdvance} loading={loading}>تسجيل</Button>
          </div>
        </div>
      </Modal>

      {/* ── REPAY MODAL ── */}
      <Modal open={showRepayModal} onClose={() => setShowRepayModal(false)} title="تسجيل سداد سلفة" size="sm">
        {selectedAdvance && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">{selectedAdvance.employeeName}</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                السلفة: {formatCurrency(selectedAdvance.amount)} · المسدد: {formatCurrency(selectedAdvance.repaidAmount || 0)} · المتبقي: {formatCurrency(selectedAdvance.amount - (selectedAdvance.repaidAmount || 0))}
              </p>
            </div>
            <Input label="مبلغ السداد (ج.م)" type="number" min={0} value={repayForm.amount} onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })} />
            <Input label="التاريخ" type="date" value={repayForm.date} onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })} />
            <Input label="ملاحظة" value={repayForm.note} onChange={(e) => setRepayForm({ ...repayForm, note: e.target.value })} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowRepayModal(false)}>إلغاء</Button>
              <Button onClick={handleRepayAdvance} loading={loading}>تسجيل السداد</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── BONUS MODAL ── */}
      <Modal open={showBonusModal} onClose={() => setShowBonusModal(false)} title="إضافة مكافأة" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الموظف</label>
            <select value={bonusForm.employeeId} onChange={(e) => setBonusForm({ ...bonusForm, employeeId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">اختر موظفاً</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <Input label="التاريخ" type="date" value={bonusForm.date} onChange={(e) => setBonusForm({ ...bonusForm, date: e.target.value })} />
          <Input label="المبلغ (ج.م)" type="number" min={0} value={bonusForm.amount} onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">السبب</label>
            <select value={bonusForm.reason} onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
              {BONUS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="ملاحظة" value={bonusForm.note} onChange={(e) => setBonusForm({ ...bonusForm, note: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowBonusModal(false)}>إلغاء</Button>
            <Button onClick={handleSaveBonus} loading={loading}>إضافة المكافأة</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
