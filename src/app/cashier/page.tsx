"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getMenuCategories, getMenuItems, createOrder } from "@/lib/firestore";
import { MenuCategory, MenuItem, OrderItem } from "@/types";
import { connectQZ, isQZConnected, printToQZ, buildCashierReceipt, buildKitchenTicket } from "@/lib/qztray";
import { toast } from "sonner";
import { ChefHat, ShoppingCart, LogOut, BarChart2, Trash2, Minus, Plus, Printer } from "lucide-react";

type CartItem = OrderItem & { imageUrl?: string };

const METHOD_LABELS = { cash: "نقدي", card: "بطاقة", wallet: "محفظة" } as const;

export default function CashierPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [qzReady, setQzReady] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [printers, setPrinters] = useState({ cashierPrinter: "", kitchenPrinter: "" });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
    loadPrinters();
    loadLogo();
    initQZ();
  }, [user]);

  async function loadData() {
    const [cats, items] = await Promise.all([getMenuCategories(), getMenuItems()]);
    const cats2 = cats as MenuCategory[];
    setCategories(cats2);
    setAllItems(items as MenuItem[]);
    if (cats2.length) setSelectedCat(cats2[0].id);
  }

  async function loadPrinters() {
    const snap = await getDoc(doc(db, "appSettings", "printers"));
    if (snap.exists()) setPrinters(snap.data() as typeof printers);
  }

  async function loadLogo() {
    const snap = await getDoc(doc(db, "appSettings", "branding"));
    if (snap.exists()) setLogoUrl(snap.data().logoUrl || snap.data().logoDataUrl || null);
  }

  async function initQZ() {
    const ok = await connectQZ();
    setQzReady(ok);
    if (!ok) toast.warning("QZ Tray غير متصل — سيتم الطباعة عبر المتصفح احتياطياً");
  }

  const displayedItems = allItems.filter((i) => i.categoryId === selectedCat && i.available);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id
            ? { ...c, qty: c.qty + 1, total: (c.qty + 1) * c.price }
            : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, qty: 1, price: item.price, total: item.price, imageUrl: item.imageUrl }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, qty: c.qty + delta, total: (c.qty + delta) * c.price }
            : c
        )
        .filter((c) => c.qty > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setNotes("");
    setPaymentMethod("cash");
  }

  const total = cart.reduce((s, c) => s + c.total, 0);

  async function handleCheckout() {
    if (!cart.length) { toast.error("السلة فارغة"); return; }
    if (!user?.email) return;
    setPlacing(true);
    try {
      const result = await createOrder({
        items: cart.map(({ menuItemId, name, qty, price, total }) => ({ menuItemId, name, qty, price, total })),
        total,
        notes,
        paymentMethod,
        cashierEmail: user.email,
      });

      const orderData = { orderNumber: result.orderNumber, items: cart, total, notes, paymentMethod };
      const cashierHtml = buildCashierReceipt({ ...orderData, restaurantName: "راية الشام" });
      const kitchenHtml = buildKitchenTicket(orderData);

      if (isQZConnected() && printers.cashierPrinter) {
        await printToQZ(printers.cashierPrinter, cashierHtml);
      } else {
        browserPrint(cashierHtml);
      }

      if (isQZConnected() && printers.kitchenPrinter) {
        await printToQZ(printers.kitchenPrinter, kitchenHtml);
      } else if (!isQZConnected()) {
        setTimeout(() => browserPrint(kitchenHtml), 500);
      }

      toast.success(`تم تسجيل الطلب #${result.orderNumber}`);
      clearCart();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setPlacing(false);
    }
  }

  function browserPrint(html: string) {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  if (loading || !user) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-950 overflow-hidden">
      {/* ── Header ── */}
      <header className="bg-slate-950 text-white flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
            {logoUrl
              ? <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
              : <ChefHat className="w-5 h-5 text-white" />
            }
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">راية الشام</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${qzReady ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            <Printer className="w-3 h-3 inline ml-1" />{qzReady ? "طابعة متصلة" : "بدون طابعة"}
          </span>
          <button onClick={() => router.push("/cashier/summary")}
            className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />مبيعات اليوم
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" />خروج
          </button>
        </div>
      </header>

      {/* ── Body: 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Col 1: Categories ── */}
        <aside className="w-36 bg-slate-900 flex flex-col gap-1.5 p-2 overflow-y-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`flex flex-col items-center gap-1 py-4 px-2 rounded-xl text-center transition-all ${
                selectedCat === cat.id
                  ? "bg-yellow-500 text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="text-3xl leading-none">{cat.icon}</span>
              <span className="text-xs font-medium leading-tight">{cat.name}</span>
            </button>
          ))}
        </aside>

        {/* ── Col 2: Items Grid ── */}
        <main className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {displayedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden text-right hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
              >
                <div className="w-full aspect-square bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                  {item.imageUrl
                    ? <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                    : <span className="text-5xl">{categories.find((c) => c.id === item.categoryId)?.icon || "🍽"}</span>
                  }
                </div>
                <div className="p-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight truncate">{item.name}</p>
                  <p className="text-base font-bold text-amber-600 mt-0.5">{item.price} ج.م</p>
                </div>
              </button>
            ))}
            {displayedItems.length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-16">
                لا توجد أصناف متاحة في هذا القسم
              </div>
            )}
          </div>
        </main>

        {/* ── Col 3: Cart ── */}
        <aside className="w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0">
          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-sm text-gray-800 dark:text-slate-200">السلة ({cart.length})</span>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 && (
              <div className="text-center text-gray-400 dark:text-slate-600 py-10 text-sm">
                اضغط على الأصناف لإضافتها
              </div>
            )}
            {cart.map((c) => (
              <div key={c.menuItemId} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-xl p-2">
                {c.imageUrl
                  ? <img src={c.imageUrl} className="w-10 h-10 object-cover rounded-lg shrink-0" alt={c.name} />
                  : <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-xl shrink-0">🍽</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{c.name}</p>
                  <p className="text-xs text-amber-600 font-bold">{c.total} ج.م</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(c.menuItemId, -1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-red-100 transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold w-5 text-center">{c.qty}</span>
                  <button onClick={() => changeQty(c.menuItemId, +1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-green-100 transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes + Payment + Checkout */}
          <div className="p-3 border-t border-gray-100 dark:border-slate-800 space-y-3">
            <textarea
              placeholder="ملاحظات (اختياري)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["cash", "card", "wallet"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${
                    paymentMethod === m
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
                  }`}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between bg-slate-950 text-white rounded-xl px-4 py-3">
              <span className="text-sm">الإجمالي</span>
              <span className="text-xl font-bold text-yellow-400">{total} ج.م</span>
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={placing || cart.length === 0}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                cart.length === 0
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-500/30 active:scale-95"
              }`}
            >
              {placing ? "جارٍ الحفظ..." : "✓ تأكيد وطباعة"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
