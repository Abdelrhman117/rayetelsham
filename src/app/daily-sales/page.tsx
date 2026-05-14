"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getDailySales, setDailySale } from "@/lib/firestore";
import { formatCurrency, todayString } from "@/lib/utils";
import { DailySale } from "@/types";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function DailySalesPage() {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [tab, setTab] = useState<"entry" | "history">("entry");
  const [loading, setLoading] = useState(false);

  const today = todayString();
  const [form, setForm] = useState({
    date: today,
    cashSales: 0,
    cardSales: 0,
    walletSales: 0,
    note: "",
  });

  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [filterEnd, setFilterEnd] = useState(today);

  useEffect(() => {
    loadSales();
  }, [filterStart, filterEnd]);

  async function loadSales() {
    const data = await getDailySales(filterStart, filterEnd);
    setSales(data as DailySale[]);

    // Pre-fill today's form if exists
    const todayData = data.find((d: Record<string, unknown>) => d.date === today) as DailySale | undefined;
    if (todayData) {
      setForm({
        date: today,
        cashSales: todayData.cashSales,
        cardSales: todayData.cardSales,
        walletSales: todayData.walletSales,
        note: todayData.note || "",
      });
    }
  }

  const totalSales = form.cashSales + form.cardSales + form.walletSales;

  async function handleSave() {
    setLoading(true);
    try {
      await setDailySale(form.date, {
        cashSales: form.cashSales,
        cardSales: form.cardSales,
        walletSales: form.walletSales,
        totalSales: form.cashSales + form.cardSales + form.walletSales,
        note: form.note,
      });
      toast.success("تم حفظ المبيعات");
      loadSales();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const totalCash = sales.reduce((s, d) => s + (d.cashSales || 0), 0);
  const totalCard = sales.reduce((s, d) => s + (d.cardSales || 0), 0);
  const totalWallet = sales.reduce((s, d) => s + (d.walletSales || 0), 0);
  const grandTotal = totalCash + totalCard + totalWallet;

  const chartData = [...sales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((d) => ({
      date: d.date.slice(5),
      نقد: d.cashSales,
      بطاقة: d.cardSales,
      محفظة: d.walletSales,
    }));

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">المبيعات اليومية (المحل)</h1>

        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {[
            { key: "entry", label: "تسجيل مبيعات اليوم" },
            { key: "history", label: "سجل المبيعات" },
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

        {tab === "entry" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card title="إدخال مبيعات">
              <div className="space-y-4">
                <Input
                  label="التاريخ"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <Input
                  label="مبيعات نقدية"
                  type="number"
                  min={0}
                  value={form.cashSales}
                  onChange={(e) => setForm({ ...form, cashSales: Number(e.target.value) })}
                />
                <Input
                  label="مبيعات بطاقة"
                  type="number"
                  min={0}
                  value={form.cardSales}
                  onChange={(e) => setForm({ ...form, cardSales: Number(e.target.value) })}
                />
                <Input
                  label="مبيعات محفظة إلكترونية"
                  type="number"
                  min={0}
                  value={form.walletSales}
                  onChange={(e) => setForm({ ...form, walletSales: Number(e.target.value) })}
                />
                <Input
                  label="ملاحظة"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />

                <div className="bg-amber-50 rounded-lg p-4 flex items-center justify-between">
                  <span className="font-medium text-amber-800">إجمالي المبيعات</span>
                  <span className="text-xl font-bold text-amber-700">{formatCurrency(totalSales)}</span>
                </div>

                <Button onClick={handleSave} loading={loading} className="w-full">
                  حفظ مبيعات {form.date}
                </Button>
              </div>
            </Card>

            <Card title="ملاحظة حول نقطة البيع">
              <div className="text-sm text-gray-600 dark:text-slate-400 space-y-3">
                <p className="font-medium text-gray-700 dark:text-slate-300">الخيار الحالي: الإدخال السريع (Option A)</p>
                <p>يتم إدخال إجمالي المبيعات النقدية وبالبطاقة والمحفظة يدوياً لكل يوم، دون خصم تلقائي من المخزون.</p>
                <hr className="border-gray-200 dark:border-slate-700" />
                <p className="text-gray-500 dark:text-slate-500 text-xs">
                  {/* Option B (POS) is planned as future improvement:
                      A full point-of-sale interface with product buttons, cart, and
                      recipe-based stock deduction from shop inventory. */}
                  الخيار ب (نقطة بيع متكاملة): مخطط كتطوير مستقبلي — سيشمل أزرار المنتجات وإدارة السلة وخصم المواد الخام من مخزون المحل تلقائياً عبر وصفات.
                </p>
              </div>
            </Card>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-5">
            <Card title="فلترة">
              <div className="flex gap-3 items-end flex-wrap">
                <Input
                  label="من"
                  type="date"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="w-40"
                />
                <Input
                  label="إلى"
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="w-40"
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">إجمالي نقد</p>
                <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalCash)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-medium">إجمالي بطاقة</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totalCard)}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm text-purple-700 font-medium">إجمالي محفظة</p>
                <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totalWallet)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700 font-medium">الإجمالي الكلي</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(grandTotal)}</p>
              </div>
            </div>

            {chartData.length > 0 && (
              <Card title="مخطط المبيعات">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                    <Legend />
                    <Bar dataKey="نقد" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="بطاقة" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="محفظة" fill="#9333ea" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Card title="تفاصيل المبيعات">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                      <th className="pb-2 font-medium">التاريخ</th>
                      <th className="pb-2 font-medium">نقد</th>
                      <th className="pb-2 font-medium">بطاقة</th>
                      <th className="pb-2 font-medium">محفظة</th>
                      <th className="pb-2 font-medium">الإجمالي</th>
                      <th className="pb-2 font-medium">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((day) => (
                      <tr key={day.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                        <td className="py-2">{day.date}</td>
                        <td className="py-2 text-green-600">{formatCurrency(day.cashSales)}</td>
                        <td className="py-2 text-blue-600">{formatCurrency(day.cardSales)}</td>
                        <td className="py-2 text-purple-600">{formatCurrency(day.walletSales)}</td>
                        <td className="py-2 font-bold text-amber-700">{formatCurrency(day.totalSales)}</td>
                        <td className="py-2 text-gray-500 dark:text-slate-500 text-xs">{day.note}</td>
                      </tr>
                    ))}
                    {!sales.length && (
                      <tr><td colSpan={6} className="text-center text-gray-400 dark:text-slate-600 py-6">لا توجد بيانات</td></tr>
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
