"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getEmployees, getSalaryRecords, setSalaryRecord } from "@/lib/firestore";
import { formatCurrency, todayString } from "@/lib/utils";
import { Employee, SalaryRecord } from "@/types";
import { toast } from "sonner";

export default function SalariesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [tab, setTab] = useState<"daily" | "history">("daily");
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [attendance, setAttendance] = useState<Record<string, { worked: boolean; paid: boolean }>>({});

  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [historyEnd, setHistoryEnd] = useState(todayString());

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadDailyRecords();
  }, [selectedDate, employees]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, historyStart, historyEnd]);

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
    const all: SalaryRecord[] = [];
    const recs = await getSalaryRecords();
    const filtered = (recs as SalaryRecord[]).filter(
      (r) => r.date >= historyStart && r.date <= historyEnd
    );
    all.push(...filtered);
    setRecords(all);
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

  const historyTotal = records.reduce((s, r) => s + (r.dailyWage || 0), 0);
  const historyPaid = records.filter((r) => r.paid).reduce((s, r) => s + (r.dailyWage || 0), 0);

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">الرواتب والحضور</h1>

        <div className="flex gap-2 border-b border-gray-200">
          {[
            { key: "daily", label: "سجل الحضور اليومي" },
            { key: "history", label: "تقرير الرواتب" },
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

        {tab === "daily" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                label="التاريخ"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44"
              />
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
                <span className="text-amber-700 font-medium">إجمالي رواتب اليوم: </span>
                <span className="font-bold text-amber-800">{formatCurrency(dailyTotal)}</span>
              </div>
            </div>

            {employees.length > 0 ? (
              <Card title={`كشف الحضور — ${selectedDate}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-600">
                        <th className="pb-2 font-medium">الموظف</th>
                        <th className="pb-2 font-medium">الدور</th>
                        <th className="pb-2 font-medium">الأجر اليومي</th>
                        <th className="pb-2 font-medium text-center">حضر</th>
                        <th className="pb-2 font-medium text-center">مدفوع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className={`border-b border-gray-50 ${attendance[emp.id]?.worked ? "bg-green-50/50" : ""}`}>
                          <td className="py-3 font-medium">{emp.name}</td>
                          <td className="py-3 text-gray-500">{emp.role}</td>
                          <td className="py-3 text-amber-700 font-medium">{formatCurrency(emp.dailyWage)}</td>
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
                        <td colSpan={2} className="pt-3 font-semibold">
                          {employees.filter((e) => attendance[e.id]?.worked).length} من {employees.length} موظفين
                        </td>
                        <td className="pt-3 font-bold text-amber-700">{formatCurrency(dailyTotal)}</td>
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
                <p className="text-gray-400 text-center py-4">
                  لا يوجد موظفون. أضفهم من صفحة <a href="/settings" className="text-amber-700 hover:underline">الإعدادات</a>.
                </p>
              </Card>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <Card title="فترة التقرير">
              <div className="flex gap-3 flex-wrap items-end">
                <Input label="من" type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="w-40" />
                <Input label="إلى" type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="w-40" />
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700 font-medium">إجمالي الرواتب</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(historyTotal)}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">المدفوع</p>
                <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(historyPaid)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">غير مدفوع</p>
                <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(historyTotal - historyPaid)}</p>
              </div>
            </div>

            <Card title="تفاصيل الرواتب">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-600">
                      <th className="pb-2 font-medium">التاريخ</th>
                      <th className="pb-2 font-medium">الموظف</th>
                      <th className="pb-2 font-medium">الأجر</th>
                      <th className="pb-2 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2">{r.date}</td>
                        <td className="py-2 font-medium">{r.employeeName}</td>
                        <td className="py-2 text-amber-700">{formatCurrency(r.dailyWage)}</td>
                        <td className="py-2">
                          {r.paid ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">مدفوع</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">مستحق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!records.length && (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-6">لا توجد سجلات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
