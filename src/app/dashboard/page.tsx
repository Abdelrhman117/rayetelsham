"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, todayString } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Users,
  ShoppingCart, AlertTriangle, CheckCircle, ChefHat,
} from "lucide-react";


interface DaySummary { date: string; sales: number; expenses: number; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

export default function DashboardPage() {
  const today = todayString();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [todaySales,    setTodaySales]    = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todaySalaries, setTodaySalaries] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unpaidSupplier,setUnpaidSupplier]= useState(0);
  const [chartData,     setChartData]     = useState<DaySummary[]>([]);

  useEffect(() => {
    getDoc(doc(db, "appSettings", "branding")).then((snap) => {
      if (snap.exists()) setLogoUrl(snap.data().logoDataUrl || null);
    });
  }, []);

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
        {/* Greeting banner */}
        <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-l from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-slate-400 text-sm font-medium">{getGreeting()} 👋</p>
              <h1 className="text-2xl font-bold mt-1 text-white">لوحة التحكم</h1>
              <p className="text-slate-500 text-sm mt-1">{today}</p>
            </div>
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20">
              {logoUrl
                ? <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
                : <ChefHat className="w-8 h-8 text-yellow-400" />
              }
            </div>
          </div>
        </div>

        {/* Today stats */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">ملخص اليوم</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="مبيعات اليوم"   value={formatCurrency(todaySales)}    icon={<TrendingUp className="w-5 h-5" />}    color="green" />
            <StatCard label="مصروفات اليوم"  value={formatCurrency(todayExpenses)} icon={<Wallet className="w-5 h-5" />}         color="red"   />
            <StatCard label="رواتب اليوم"    value={formatCurrency(todaySalaries)} icon={<Users className="w-5 h-5" />}          color="amber" />
            <StatCard
              label="صافي التدفق"
              value={formatCurrency(netCashFlow)}
              icon={netCashFlow >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              color={netCashFlow >= 0 ? "green" : "red"}
            />
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">تنبيهات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatCard
              label="مستحق للموردين"
              value={formatCurrency(unpaidSupplier)}
              icon={<ShoppingCart className="w-5 h-5" />}
              color="red"
              sub="إجمالي الفواتير غير المسددة"
            />
            <StatCard
              label="أصناف منخفضة المخزون"
              value={String(lowStockCount)}
              icon={lowStockCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              color={lowStockCount > 0 ? "red" : "green"}
              sub={lowStockCount > 0 ? "تحتاج إعادة تخزين" : "المخزون في وضع جيد"}
            />
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-5">المبيعات والمصروفات — آخر 7 أيام</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-800" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={55}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(value as number)}
                labelStyle={{ direction: "rtl", fontWeight: "bold" }}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", backgroundColor: "#1e293b", color: "#f1f5f9" }}
              />
              <Legend formatter={(v) => (v === "sales" ? "المبيعات" : "المصروفات")} iconType="circle" />
              <Bar dataKey="sales"    name="sales"    fill="#eab308" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
