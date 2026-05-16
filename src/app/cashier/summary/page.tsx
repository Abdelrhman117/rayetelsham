"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrders } from "@/lib/firestore";
import { Order } from "@/types";
import { ArrowRight, ShoppingBag, Banknote, CreditCard, Wallet } from "lucide-react";

export default function CashierSummaryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    getOrders(today).then((res) => {
      setOrders(res as Order[]);
      setDataLoading(false);
    });
  }, [user]);

  const cash   = orders.filter((o) => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
  const card   = orders.filter((o) => o.paymentMethod === "card").reduce((s, o) => s + o.total, 0);
  const wallet = orders.filter((o) => o.paymentMethod === "wallet").reduce((s, o) => s + o.total, 0);
  const total  = cash + card + wallet;

  const today = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 p-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/cashier")}
            className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">مبيعات اليوم</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">{today}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 bg-slate-950 text-white rounded-2xl p-5 text-center">
            <p className="text-sm text-slate-400">إجمالي المبيعات</p>
            <p className="text-4xl font-bold text-yellow-400 mt-1">{total.toLocaleString("ar-EG")} ج.م</p>
            <p className="text-sm text-slate-400 mt-2 flex items-center justify-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />{orders.length} طلب
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <Banknote className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-600 dark:text-slate-400">نقدي</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{cash.toLocaleString("ar-EG")} ج.م</p>
            <p className="text-xs text-gray-400 mt-0.5">{orders.filter((o) => o.paymentMethod === "cash").length} طلب</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-gray-600 dark:text-slate-400">بطاقة</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{card.toLocaleString("ar-EG")} ج.م</p>
            <p className="text-xs text-gray-400 mt-0.5">{orders.filter((o) => o.paymentMethod === "card").length} طلب</p>
          </div>

          <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm text-gray-600 dark:text-slate-400">محفظة إلكترونية</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{wallet.toLocaleString("ar-EG")} ج.م</p>
            <p className="text-xs text-gray-400 mt-0.5">{orders.filter((o) => o.paymentMethod === "wallet").length} طلب</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <h2 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">الطلبات ({orders.length})</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {dataLoading && (
              <div className="text-center text-gray-400 py-8 text-sm">جارٍ التحميل...</div>
            )}
            {!dataLoading && orders.length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">لا توجد طلبات اليوم</div>
            )}
            {orders.map((o) => {
              const methodLabel = { cash: "نقدي", card: "بطاقة", wallet: "محفظة" }[o.paymentMethod];
              const time = (o.createdAt as { toDate: () => Date })?.toDate?.()?.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) || "";
              return (
                <div key={o.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-amber-700">#{o.orderNumber}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                        {o.items.map((i) => `${i.name} ×${i.qty}`).join("، ")}
                      </p>
                      <p className="text-xs text-gray-400">{time} — {methodLabel}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100 shrink-0">{o.total} ج.م</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
