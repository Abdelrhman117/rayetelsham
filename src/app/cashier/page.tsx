"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getMenuCategories, getMenuItems, createOrder } from "@/lib/firestore";
import { MenuCategory, MenuItem, OrderItem } from "@/types";
import { connectQZ, isQZConnected, printToQZ, buildCashierReceipt, buildKitchenTicket } from "@/lib/qztray";
import { toast } from "sonner";
import { ChefHat, LogOut, BarChart2, Trash2, Minus, Plus, Wifi, WifiOff } from "lucide-react";

type CartItem = OrderItem & { imageUrl?: string };

const METHOD_LABELS = { cash: "نقدي", card: "بطاقة", wallet: "محفظة" } as const;
const METHOD_ICONS  = { cash: "💵", card: "💳", wallet: "📱" } as const;

export default function CashierPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [categories, setCategories]   = useState<MenuCategory[]>([]);
  const [allItems, setAllItems]       = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [notes, setNotes]             = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [qzReady, setQzReady]         = useState(false);
  const [placing, setPlacing]         = useState(false);
  const [printers, setPrinters]       = useState({ cashierPrinter: "", kitchenPrinter: "" });
  const [logoUrl, setLogoUrl]         = useState<string | null>(null);

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
  const total = cart.reduce((s, c) => s + c.total, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

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
      return [...prev, {
        menuItemId: item.id, name: item.name,
        qty: 1, price: item.price, total: item.price, imageUrl: item.imageUrl,
      }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => c.menuItemId === menuItemId
          ? { ...c, qty: c.qty + delta, total: (c.qty + delta) * c.price }
          : c)
        .filter((c) => c.qty > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setNotes("");
    setPaymentMethod("cash");
  }

  async function handleCheckout() {
    if (!cart.length) { toast.error("السلة فارغة"); return; }
    if (!user?.email) return;
    setPlacing(true);
    try {
      const result = await createOrder({
        items: cart.map(({ menuItemId, name, qty, price, total }) => ({ menuItemId, name, qty, price, total })),
        total, notes, paymentMethod, cashierEmail: user.email,
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

      toast.success(`✓ طلب #${result.orderNumber} تم بنجاح`);
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

  if (loading || !user) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#f0f2f5" }}>

      {/* ══════════════ HEADER ══════════════ */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3"
        style={{ background: "#1a1f2e", borderBottom: "1px solid #2d3448" }}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            {logoUrl
              ? <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
              : <ChefHat className="w-5 h-5 text-white" />
            }
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">راية الشام</p>
            <p className="text-xs" style={{ color: "#6b7a9e" }}>{user.email}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Printer status */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${
            qzReady ? "text-emerald-400" : "text-slate-500"
          }`} style={{ background: "rgba(255,255,255,0.05)" }}>
            {qzReady
              ? <Wifi className="w-3.5 h-3.5" />
              : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{qzReady ? "طابعة متصلة" : "بدون طابعة"}</span>
          </div>

          <button onClick={() => router.push("/cashier/summary")}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            <BarChart2 className="w-3.5 h-3.5" />
            <span>مبيعاتي</span>
          </button>

          <button onClick={async () => { await signOut(auth); router.push("/login"); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* ══════════════ BODY ══════════════ */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ── CATEGORIES (right column, RTL) ── */}
        <aside className="shrink-0 w-[130px] flex flex-col gap-2 p-2.5 overflow-y-auto"
          style={{ background: "#1a1f2e" }}>
          {categories.map((cat) => {
            const active = selectedCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className="flex flex-col items-center gap-2 py-5 px-2 rounded-2xl text-center transition-all duration-200"
                style={{
                  background: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                  border: active ? "1.5px solid rgba(245,158,11,0.5)" : "1.5px solid transparent",
                  color: active ? "#f59e0b" : "#8892ab",
                }}
              >
                <span className="text-3xl leading-none">{cat.icon}</span>
                <span className="text-xs font-semibold leading-tight">{cat.name}</span>
                {active && <div className="w-5 h-0.5 rounded-full" style={{ background: "#f59e0b" }} />}
              </button>
            );
          })}
        </aside>

        {/* ── ITEMS GRID ── */}
        <main className="flex-1 overflow-y-auto p-4">
          {/* Category title */}
          {selectedCat && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{categories.find((c) => c.id === selectedCat)?.icon}</span>
              <h2 className="text-lg font-bold text-gray-700">
                {categories.find((c) => c.id === selectedCat)?.name}
              </h2>
              <span className="text-sm text-gray-400">({displayedItems.length})</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayedItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="relative rounded-2xl overflow-hidden text-right transition-all duration-200 active:scale-[0.96] group"
                  style={{
                    background: "#ffffff",
                    boxShadow: inCart
                      ? "0 0 0 2.5px #f59e0b, 0 4px 16px rgba(245,158,11,0.15)"
                      : "0 1px 4px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Image */}
                  <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center"
                    style={{ background: "#f8f9fa" }}>
                    {item.imageUrl
                      ? <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt={item.name} />
                      : <span className="text-5xl select-none">{categories.find((c) => c.id === item.categoryId)?.icon || "🍽"}</span>
                    }
                  </div>

                  {/* Badge if in cart */}
                  {inCart && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "#f59e0b" }}>
                      {inCart.qty}
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold leading-snug truncate" style={{ color: "#1a1f2e" }}>{item.name}</p>
                    <p className="text-base font-bold mt-1" style={{ color: "#d97706" }}>{item.price} ج.م</p>
                  </div>
                </button>
              );
            })}

            {displayedItems.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-300 select-none">
                <span className="text-6xl mb-3">🍽</span>
                <p className="text-sm">لا توجد أصناف متاحة في هذا القسم</p>
              </div>
            )}
          </div>
        </main>

        {/* ── CART (left column, RTL) ── */}
        <aside className="shrink-0 w-[280px] flex flex-col"
          style={{ background: "#ffffff", borderRight: "1px solid #e8eaf0" }}>

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3.5 shrink-0"
            style={{ borderBottom: "1px solid #f0f2f5" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.1)" }}>
                <span className="text-base">🛒</span>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#1a1f2e" }}>الطلب الحالي</p>
                <p className="text-xs" style={{ color: "#8892ab" }}>{cartCount} صنف</p>
              </div>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: "#f87171" }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full pb-6 select-none"
                style={{ color: "#c4cad8" }}>
                <span className="text-5xl mb-3">🧾</span>
                <p className="text-sm">اضغط على صنف لإضافته</p>
              </div>
            )}

            {cart.map((c) => (
              <div key={c.menuItemId}
                className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all"
                style={{ background: "#f8f9fb" }}>
                {/* Thumb */}
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: "#f0f2f5" }}>
                  {c.imageUrl
                    ? <img src={c.imageUrl} className="w-full h-full object-cover" alt={c.name} />
                    : <span className="text-xl">🍽</span>
                  }
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#1a1f2e" }}>{c.name}</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: "#d97706" }}>{c.total} ج.م</p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => changeQty(c.menuItemId, -1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: "#fee2e2", color: "#ef4444" }}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold w-5 text-center" style={{ color: "#1a1f2e" }}>{c.qty}</span>
                  <button onClick={() => changeQty(c.menuItemId, +1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: "#dcfce7", color: "#16a34a" }}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer: notes + payment + total + checkout */}
          <div className="shrink-0 p-3 space-y-2.5"
            style={{ borderTop: "1px solid #f0f2f5" }}>

            {/* Notes */}
            <textarea
              placeholder="ملاحظات على الطلب..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs resize-none focus:outline-none rounded-xl px-3 py-2.5 transition-all"
              style={{
                background: "#f8f9fb",
                border: "1.5px solid #e8eaf0",
                color: "#1a1f2e",
              }}
              onFocus={(e) => e.target.style.borderColor = "#f59e0b"}
              onBlur={(e) => e.target.style.borderColor = "#e8eaf0"}
            />

            {/* Payment methods */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["cash", "card", "wallet"] as const).map((m) => {
                const active = paymentMethod === m;
                return (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: active ? "rgba(245,158,11,0.12)" : "#f8f9fb",
                      border: active ? "1.5px solid rgba(245,158,11,0.6)" : "1.5px solid transparent",
                      color: active ? "#d97706" : "#8892ab",
                    }}
                  >
                    <span className="text-lg leading-none">{METHOD_ICONS[m]}</span>
                    <span>{METHOD_LABELS[m]}</span>
                  </button>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "#1a1f2e" }}>
              <span className="text-sm font-medium" style={{ color: "#8892ab" }}>الإجمالي</span>
              <span className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
                {total.toLocaleString("ar-EG")} <span className="text-sm font-medium">ج.م</span>
              </span>
            </div>

            {/* Checkout */}
            <button
              onClick={handleCheckout}
              disabled={placing || cart.length === 0}
              className="w-full py-4 rounded-2xl text-base font-bold transition-all duration-200"
              style={{
                background: cart.length === 0 ? "#e8eaf0" : "linear-gradient(135deg,#f59e0b,#d97706)",
                color: cart.length === 0 ? "#a0aab8" : "#1a1f2e",
                boxShadow: cart.length > 0 ? "0 4px 20px rgba(245,158,11,0.35)" : "none",
                transform: "scale(1)",
              }}
              onMouseDown={(e) => { if (cart.length > 0) (e.currentTarget.style.transform = "scale(0.97)"); }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {placing ? "جارٍ الحفظ..." : "✓ تأكيد وطباعة"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
