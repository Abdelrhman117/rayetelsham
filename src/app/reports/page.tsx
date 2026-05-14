"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getDailySales, getExpenses, getSalaryRecords, getSupplierInvoices } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface PLReport {
  month: string;
  shopSales: number;
  totalRevenue: number;
  purchases: number;
  openingStock: number;
  closingStock: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  salaries: number;
  operatingExpenses: number;
  netProfit: number;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"pl" | "expenses" | "sales">("pl");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<PLReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingStockValue, setOpeningStockValue] = useState(0);
  const [closingStockValue, setClosingStockValue] = useState(0);

  // Expense report state
  const [expMonth, setExpMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expData, setExpData] = useState<{ category: string; total: number }[]>([]);

  // Sales report state
  const [salesMonth, setSalesMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [salesChartData, setSalesChartData] = useState<{ date: string; مبيعات: number }[]>([]);

  async function generatePL() {
    setLoading(true);
    try {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const [dailySales, supplierInvoices, expenses, salaryRecs] = await Promise.all([
        getDailySales(startDate, endDate),
        getSupplierInvoices(),
        getExpenses(startDate, endDate),
        getSalaryRecords(),
      ]);

      const shopSales = (dailySales as Record<string, unknown>[]).reduce((s, d) => s + ((d.totalSales as number) || 0), 0);

      const monthPurchases = (supplierInvoices as Record<string, unknown>[]).filter((inv) => {
        const d = inv.date as { toDate: () => Date };
        return d.toDate().toISOString().slice(0, 7) === month;
      });
      const purchases = monthPurchases.reduce((s, inv) => s + ((inv.totalAmount as number) || 0), 0);

      const totalRevenue = shopSales;

      // COGS = (Opening Stock + Purchases) - Closing Stock
      const openingStock = openingStockValue;
      const closingStock = closingStockValue;
      const cogs = Math.max(0, openingStock + purchases - closingStock);
      const grossProfit = totalRevenue - cogs;

      const totalExpenses = (expenses as Record<string, unknown>[]).reduce((s, e) => s + ((e.amount as number) || 0), 0);
      const monthSalaries = (salaryRecs as Record<string, unknown>[]).filter(
        (r) => (r.date as string).startsWith(month)
      );
      const totalSalaries = monthSalaries.reduce((s, r) => s + ((r.dailyWage as number) || 0), 0);

      const operatingExpenses = totalExpenses + totalSalaries;
      const netProfit = grossProfit - operatingExpenses;

      setReport({
        month,
        shopSales,
        totalRevenue,
        purchases,
        openingStock,
        closingStock,
        cogs,
        grossProfit,
        expenses: totalExpenses,
        salaries: totalSalaries,
        operatingExpenses,
        netProfit,
      });
    } catch (e) {
      console.error(e);
      toast.error("خطأ في إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  }

  async function loadExpenseReport() {
    const startDate = expMonth + "-01";
    const endDate = expMonth + "-31";
    const data = await getExpenses(startDate, endDate);
    const byCategory: Record<string, number> = {};
    for (const exp of data as Record<string, unknown>[]) {
      const cat = exp.category as string;
      byCategory[cat] = (byCategory[cat] || 0) + ((exp.amount as number) || 0);
    }
    setExpData(Object.entries(byCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total));
  }

  async function loadSalesReport() {
    const startDate = salesMonth + "-01";
    const endDate = salesMonth + "-31";
    const daily = await getDailySales(startDate, endDate);
    const byDate: Record<string, number> = {};
    for (const d of daily as Record<string, unknown>[]) {
      byDate[d.date as string] = (byDate[d.date as string] || 0) + ((d.totalSales as number) || 0);
    }
    const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
    setSalesChartData(sorted.map(([date, sales]) => ({ date: date.slice(5), مبيعات: sales })));
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">التقارير والإحصائيات</h1>

        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {[
            { key: "pl", label: "الأرباح والخسائر" },
            { key: "expenses", label: "تقرير المصروفات" },
            { key: "sales", label: "تقرير المبيعات" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-yellow-500 text-yellow-600 dark:text-yellow-400 dark:border-yellow-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "pl" && (
          <div className="space-y-4">
            <Card title="إعداد تقرير الأرباح والخسائر">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Input label="الشهر" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                <Input
                  label="قيمة المخزون الافتتاحي (أول الشهر)"
                  type="number"
                  min={0}
                  value={openingStockValue}
                  onChange={(e) => setOpeningStockValue(Number(e.target.value))}
                />
                <Input
                  label="قيمة المخزون الختامي (نهاية الشهر)"
                  type="number"
                  min={0}
                  value={closingStockValue}
                  onChange={(e) => setClosingStockValue(Number(e.target.value))}
                />
              </div>
              <div className="mt-4">
                <Button onClick={generatePL} loading={loading}>إنشاء التقرير</Button>
              </div>
            </Card>

            {report && (
              <Card title={`قائمة الأرباح والخسائر — ${report.month}`}>
                <div className="space-y-1">
                  <Section title="الإيرادات" color="green">
                    <Row label="مبيعات المحل (نقدية/يومية)" value={report.shopSales} />
                    <Row label="إجمالي الإيرادات" value={report.totalRevenue} bold />
                  </Section>

                  <Section title="تكلفة البضاعة المباعة (COGS)" color="amber">
                    <Row label="مخزون افتتاحي" value={report.openingStock} />
                    <Row label="+ مشتريات الشهر" value={report.purchases} />
                    <Row label="- مخزون ختامي" value={report.closingStock} />
                    <Row label="تكلفة البضاعة المباعة" value={report.cogs} bold />
                  </Section>

                  <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${report.grossProfit >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <span className="font-bold text-gray-800 dark:text-slate-200 text-base">مجمل الربح</span>
                    <span className={`font-bold text-base ${report.grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(report.grossProfit)}
                    </span>
                  </div>

                  <Section title="المصروفات التشغيلية" color="red">
                    <Row label="مصروفات (إيجار، كهرباء، ...)" value={report.expenses} />
                    <Row label="رواتب الموظفين" value={report.salaries} />
                    <Row label="إجمالي المصروفات التشغيلية" value={report.operatingExpenses} bold />
                  </Section>

                  <div className={`flex items-center justify-between py-4 px-4 rounded-xl border-2 mt-4 ${report.netProfit >= 0 ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"}`}>
                    <span className="font-bold text-gray-900 dark:text-slate-100 text-lg">صافي الربح / الخسارة</span>
                    <span className={`font-bold text-2xl ${report.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {report.netProfit >= 0 ? "+" : ""}{formatCurrency(report.netProfit)}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "expenses" && (
          <div className="space-y-4">
            <Card title="فترة التقرير">
              <div className="flex gap-3 items-end flex-wrap">
                <Input label="الشهر" type="month" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} />
                <Button onClick={loadExpenseReport}>عرض التقرير</Button>
              </div>
            </Card>
            {expData.length > 0 && (
              <Card title="المصروفات حسب التصنيف">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expData} layout="vertical" margin={{ right: 20, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                    <Bar dataKey="total" fill="#b45309" radius={[0, 4, 4, 0]} name="المبلغ" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-600 dark:text-slate-400">
                        <th className="pb-2 font-medium">التصنيف</th>
                        <th className="pb-2 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expData.map((row) => (
                        <tr key={row.category} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                          <td className="py-2">{row.category}</td>
                          <td className="py-2 font-medium text-red-600">{formatCurrency(row.total)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="pt-2">المجموع</td>
                        <td className="pt-2 text-red-700">{formatCurrency(expData.reduce((s, r) => s + r.total, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-4">
            <Card title="فترة التقرير">
              <div className="flex gap-3 items-end flex-wrap">
                <Input label="الشهر" type="month" value={salesMonth} onChange={(e) => setSalesMonth(e.target.value)} />
                <Button onClick={loadSalesReport}>عرض التقرير</Button>
              </div>
            </Card>
            {salesChartData.length > 0 && (
              <Card title="المبيعات اليومية">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                    <Bar dataKey="مبيعات" fill="#b45309" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color: "green" | "amber" | "red" }) {
  const colors = {
    green: "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/20",
    amber: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20",
    red: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20",
  };
  return (
    <div className="mb-3">
      <div className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-t-lg ${colors[color]}`}>{title}</div>
      <div className="border border-gray-100 dark:border-slate-700 rounded-b-lg divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${bold ? "bg-gray-50 dark:bg-slate-900" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-gray-800 dark:text-slate-200" : "text-gray-600 dark:text-slate-400"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-gray-900 dark:text-slate-100" : "text-gray-700 dark:text-slate-300"}`}>{formatCurrency(value)}</span>
    </div>
  );
}
