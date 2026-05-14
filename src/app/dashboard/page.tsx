"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, todayString, monthString } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface DaySummary {
  date: string;
  sales: number;
  expenses: number;
}

export default function DashboardPage() {
  const today = todayString();
  const [todaySales, setTodaySales] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todaySalaries, setTodaySalaries] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unpaidSupplier, setUnpaidSupplier] = useState(0);
  const [unpaidCustomer, setUnpaidCustomer] = useState(0);
  const [chartData, setChartData] = useState<DaySummary[]>([]);

  useEffect(() => {
    // Today daily sales
    const unsub = onSnapshot(
      query(collection(db, "dailySales"), where("date", "==", today)),
      (snap) => {
        const total = snap.docs.reduce((s, d) => s + (d.data().totalSales || 0), 0);
        setTodaySales(total);
      }
    );
    return unsub;
  }, [today]);

  useEffect(() => {
    // Today expenses
    getDocs(query(collection(db, "expenses"), where("date", "==", today))).then((snap) => {
      setTodayExpenses(snap.docs.reduce((s, d) => s + (d.data().amount || 0), 0));
    });
    // Today salaries
    getDocs(query(collection(db, "salaries"), where("date", "==", today))).then((snap) => {
      setTodaySalaries(snap.docs.reduce((s, d) => s + (d.data().dailyWage || 0), 0));
    });
    // Low stock
    getDocs(collection(db, "items")).then((snap) => {
      const low = snap.docs.filter((d) => {
        const item = d.data();
        return (
          (item.stockMain || 0) + (item.stockShop || 0) <= (item.lowStockThreshold || 0)
        );
      });
      setLowStockCount(low.length);
    });
    // Unpaid supplier invoices
    getDocs(
      query(collection(db, "supplierInvoices"), where("status", "in", ["unpaid", "partial"]))
    ).then((snap) => {
      setUnpaidSupplier(
        snap.docs.reduce((s, d) => s + ((d.data().totalAmount || 0) - (d.data().paidAmount || 0)), 0)
      );
    });
    // Unpaid customer invoices
    getDocs(
      query(collection(db, "salesInvoices"), where("status", "in", ["unpaid", "partial"]))
    ).then((snap) => {
      setUnpaidCustomer(
        snap.docs.reduce((s, d) => s + ((d.data().totalAmount || 0) - (d.data().paidAmount || 0)), 0)
      );
    });

    // Last 7 days chart
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
        getDocs(query(collection(db, "expenses"), where("date", "==", dateStr))),
      ]);
      const sales = salesSnap.docs.reduce((s, doc) => s + (doc.data().totalSales || 0), 0);
      const expenses = expSnap.docs.reduce((s, doc) => s + (doc.data().amount || 0), 0);
      days.push({ date: dateStr.slice(5), sales, expenses });
    }
    setChartData(days);
  }

  const netCashFlow = todaySales - todayExpenses - todaySalaries;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-sm text-gray-500 mt-1">اليوم: {today}</p>
        </div>

        {/* Today stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="مبيعات اليوم" value={formatCurrency(todaySales)} icon="💰" color="green" />
          <StatCard label="مصروفات اليوم" value={formatCurrency(todayExpenses)} icon="💸" color="red" />
          <StatCard label="رواتب اليوم" value={formatCurrency(todaySalaries)} icon="👷" color="amber" />
          <StatCard
            label="صافي التدفق"
            value={formatCurrency(netCashFlow)}
            icon={netCashFlow >= 0 ? "📈" : "📉"}
            color={netCashFlow >= 0 ? "green" : "red"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="مستحق للموردين"
            value={formatCurrency(unpaidSupplier)}
            icon="🛒"
            color="red"
            sub="إجمالي الفواتير غير المسددة"
          />
          <StatCard
            label="مستحق من العملاء"
            value={formatCurrency(unpaidCustomer)}
            icon="💼"
            color="blue"
            sub="إجمالي الفواتير غير المحصلة"
          />
          <StatCard
            label="أصناف منخفضة المخزون"
            value={lowStockCount}
            icon="⚠️"
            color={lowStockCount > 0 ? "red" : "green"}
            sub={lowStockCount > 0 ? "تحتاج إعادة تخزين" : "المخزون بوضع جيد"}
          />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">المبيعات والمصروفات (آخر 7 أيام)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(value as number)}
                labelStyle={{ direction: "rtl" }}
              />
              <Legend
                formatter={(value) => (value === "sales" ? "المبيعات" : "المصروفات")}
              />
              <Bar dataKey="sales" name="sales" fill="#b45309" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
