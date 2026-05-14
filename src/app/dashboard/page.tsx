"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, todayString } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface DaySummary { date: string; sales: number; expenses: number; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

export default function DashboardPage() {
  const today = todayString();
  const [todaySales,    setTodaySales]    = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todaySalaries, setTodaySalaries] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unpaidSupplier,setUnpaidSupplier]= useState(0);
  const [chartData,     setChartData]     = useState<DaySummary[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "dailySales"), where("date", "==", today)),
      (snap) => setTodaySales(snap.docs.reduce((s, d) => s + (d.data().totalSales || 0), 0))
    );
    return unsub;
  }, [today]);

  useEffect(() => {
    getDocs(query(collection(db, "expenses"), where("date", "==", today))).then((snap) =>
      setTodayExpenses(snap.docs.reduce((s, d) => s + (d.data().amount || 0), 0))
    );
    getDocs(query(collection(db, "salaries"), where("date", "==", today))).then((snap) =>
      setTodaySalaries(snap.docs.reduce((s, d) => s + (d.data().dailyWage || 0), 0))
    );
    getDocs(collection(db, "items")).then((snap) =>
      setLowStockCount(snap.docs.filter((d) => {
        const item = d.data();
        return (item.stockMain || 0) + (item.stockShop || 0) <= (item.lowStockThreshold || 0);
      }).length)
    );
    getDocs(query(collection(db, "supplierInvoices"), where("status", "in", ["unpaid", "partial"]))).then((snap) =>
      setUnpaidSupplier(snap.docs.reduce((s, d) => s + ((d.data().totalAmount || 0) - (d.data().paidAmount || 0)), 0))
    );
    buildChartData();
  }, [today]);

  async function buildChartData() {
    const days: DaySummary[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const [salesSnap, expSnap] = await Promise.all([
        getDocs(query(collection(db, "dailySales"), where("date", "==", dateStr))),
        getDocs(query(collection(db, "expenses"),   where("date", "==", dateStr))),
      ]);
      days.push({
        date: dateStr.slice(5),
        sales:    salesSnap.docs.reduce((s, doc) => s + (doc.data().totalSales || 0), 0),
        expenses: expSnap.docs.reduce((s, doc) => s + (doc.data().amount || 0), 0),
      });
    }
    setChartData(days);
  }

  const netCashFlow = todaySales - todayExpenses - todaySalaries;

  return (
    <AppShell>
      <div className="space-y-6">

        {/* Greeting */}
        <div className="bg-gradient-to-l from-amber-600 to-amber-800 dark:from-amber-800 dark:to-amber-950 rounded-2xl p-5 text-white shadow-lg shadow-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-200 text-sm font-medium">{getGreeting()} 👋</p>
              <h1 className="text-2xl font-bold mt-1">لوحة التحكم</h1>
              <p className="text-amber-300/80 text-sm mt-1">{today}</p>
            </div>
            <div className="text-5xl opacity-80">🥙</div>
          </div>
        </div>

        {/* Today stats */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3 px-1">ملخص اليوم</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="مبيعات اليوم"   value={formatCurrency(todaySales)}    icon="💰" color="green" />
            <StatCard label="مصروفات اليوم"  value={formatCurrency(todayExpenses)} icon="💸" color="red"   />
            <StatCard label="رواتب اليوم"    value={formatCurrency(todaySalaries)} icon="👷" color="amber" />
            <StatCard
              label="صافي التدفق"
              value={formatCurrency(netCashFlow)}
              icon={netCashFlow >= 0 ? "📈" : "📉"}
              color={netCashFlow >= 0 ? "green" : "red"}
            />
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3 px-1">تنبيهات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatCard
              label="مستحق للموردين"
              value={formatCurrency(unpaidSupplier)}
              icon="🛒"
              color="red"
              sub="إجمالي الفواتير غير المسددة"
            />
            <StatCard
              label="أصناف منخفضة المخزون"
              value={String(lowStockCount)}
              icon="⚠️"
              color={lowStockCount > 0 ? "red" : "green"}
              sub={lowStockCount > 0 ? "تحتاج إعادة تخزين" : "المخزون في وضع جيد"}
            />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-5">المبيعات والمصروفات — آخر 7 أيام</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={55}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(value as number)}
                labelStyle={{ direction: "rtl", fontWeight: "bold" }}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
              />
              <Legend formatter={(v) => (v === "sales" ? "المبيعات" : "المصروفات")} iconType="circle" />
              <Bar dataKey="sales"    name="sales"    fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </AppShell>
  );
}
