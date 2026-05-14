"use client";
import { useEffect, useState } from "react";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  transferStock,
  addInventoryCount,
  getInventoryCounts,
} from "@/lib/firestore";
import { formatNumber, UNITS, todayString } from "@/lib/utils";
import { toast } from "sonner";
import { Item } from "@/types";

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<"items" | "transfer" | "count">("items");
  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);

  // Item form
  const [itemForm, setItemForm] = useState({
    name: "",
    unit: "كغ",
    stockMain: 0,
    stockShop: 0,
    lowStockThreshold: 5,
  });

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    fromWarehouse: "main" as "main" | "shop",
    toWarehouse: "shop" as "main" | "shop",
    note: "",
    date: todayString(),
    transferItems: [{ itemId: "", itemName: "", quantity: 1 }],
  });

  // Count form
  const [countForm, setCountForm] = useState<{
    date: string;
    month: string;
    note: string;
    countItems: { itemId: string; itemName: string; unit: string; bookMain: number; bookShop: number; actualMain: number; actualShop: number }[];
  }>({
    date: todayString(),
    month: todayString().slice(0, 7),
    note: "",
    countItems: [],
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "items"), orderBy("name")),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
        setItems(data);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    getInventoryCounts().then(setCounts);
  }, []);

  function openAddItem() {
    setEditItem(null);
    setItemForm({ name: "", unit: "كغ", stockMain: 0, stockShop: 0, lowStockThreshold: 5 });
    setItemModal(true);
  }

  function openEditItem(item: Item) {
    setEditItem(item);
    setItemForm({
      name: item.name,
      unit: item.unit,
      stockMain: item.stockMain,
      stockShop: item.stockShop,
      lowStockThreshold: item.lowStockThreshold,
    });
    setItemModal(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim()) { toast.error("يرجى إدخال اسم الصنف"); return; }
    setLoading(true);
    try {
      if (editItem) {
        await updateItem(editItem.id, itemForm);
        toast.success("تم تحديث الصنف");
      } else {
        await addItem(itemForm);
        toast.success("تم إضافة الصنف");
      }
      setItemModal(false);
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
    await deleteItem(id);
    toast.success("تم الحذف");
  }

  async function handleTransfer() {
    const validItems = transferForm.transferItems.filter((i) => i.itemId && i.quantity > 0);
    if (!validItems.length) { toast.error("أضف صنفاً واحداً على الأقل"); return; }
    if (transferForm.fromWarehouse === transferForm.toWarehouse) { toast.error("يجب أن يكون المخزنان مختلفين"); return; }
    setLoading(true);
    try {
      await transferStock({
        fromWarehouse: transferForm.fromWarehouse,
        toWarehouse: transferForm.toWarehouse,
        items: validItems,
        note: transferForm.note,
      });
      toast.success("تم النقل بنجاح");
      setTransferForm({
        fromWarehouse: "main",
        toWarehouse: "shop",
        note: "",
        date: todayString(),
        transferItems: [{ itemId: "", itemName: "", quantity: 1 }],
      });
    } catch {
      toast.error("حدث خطأ أثناء النقل");
    } finally {
      setLoading(false);
    }
  }

  function initCountForm() {
    setCountForm({
      date: todayString(),
      month: todayString().slice(0, 7),
      note: "",
      countItems: items.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        bookMain: item.stockMain,
        bookShop: item.stockShop,
        actualMain: item.stockMain,
        actualShop: item.stockShop,
      })),
    });
  }

  async function handleSaveCount() {
    setLoading(true);
    try {
      await addInventoryCount(countForm);
      toast.success("تم حفظ الجرد");
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {[
            { key: "items", label: "الأصناف" },
            { key: "transfer", label: "نقل بضاعة" },
            { key: "count", label: "جرد المخزون" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-amber-700 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "items" && (
          <Card
            title={`الأصناف (${items.length})`}
            actions={<Button size="sm" onClick={openAddItem}>+ إضافة صنف</Button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 font-medium text-gray-600">الصنف</th>
                    <th className="pb-2 font-medium text-gray-600">الوحدة</th>
                    <th className="pb-2 font-medium text-gray-600">المخزن الرئيسي</th>
                    <th className="pb-2 font-medium text-gray-600">المحل</th>
                    <th className="pb-2 font-medium text-gray-600">حد التنبيه</th>
                    <th className="pb-2 font-medium text-gray-600">الحالة</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const total = item.stockMain + item.stockShop;
                    const isLow = total <= item.lowStockThreshold;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2 text-gray-500">{item.unit}</td>
                        <td className="py-2">{formatNumber(item.stockMain)}</td>
                        <td className="py-2">{formatNumber(item.stockShop)}</td>
                        <td className="py-2 text-gray-500">{item.lowStockThreshold}</td>
                        <td className="py-2">
                          {isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                              ⚠️ منخفض
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                              ✓ كافٍ
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditItem(item)}
                              className="text-xs text-amber-700 hover:underline px-2"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-xs text-red-600 hover:underline px-2"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-400 py-6">
                        لا توجد أصناف بعد. أضف أول صنف.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "transfer" && (
          <Card title="نقل بضاعة بين المخزنين">
            <div className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="من"
                  value={transferForm.fromWarehouse}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, fromWarehouse: e.target.value as "main" | "shop" })
                  }
                >
                  <option value="main">المخزن الرئيسي</option>
                  <option value="shop">المحل</option>
                </Select>
                <Select
                  label="إلى"
                  value={transferForm.toWarehouse}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, toWarehouse: e.target.value as "main" | "shop" })
                  }
                >
                  <option value="shop">المحل</option>
                  <option value="main">المخزن الرئيسي</option>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">الأصناف</label>
                <div className="space-y-2">
                  {transferForm.transferItems.map((ti, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={ti.itemId}
                        onChange={(e) => {
                          const item = items.find((i) => i.id === e.target.value);
                          const updated = [...transferForm.transferItems];
                          updated[idx] = {
                            ...updated[idx],
                            itemId: e.target.value,
                            itemName: item?.name || "",
                          };
                          setTransferForm({ ...transferForm, transferItems: updated });
                        }}
                      >
                        <option value="">اختر صنف</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (المخزن: {formatNumber(transferForm.fromWarehouse === "main" ? i.stockMain : i.stockShop)} {i.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={ti.quantity}
                        onChange={(e) => {
                          const updated = [...transferForm.transferItems];
                          updated[idx].quantity = Number(e.target.value);
                          setTransferForm({ ...transferForm, transferItems: updated });
                        }}
                      />
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const updated = transferForm.transferItems.filter((_, i) => i !== idx);
                            setTransferForm({ ...transferForm, transferItems: updated });
                          }}
                          className="text-red-500 text-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setTransferForm({
                      ...transferForm,
                      transferItems: [...transferForm.transferItems, { itemId: "", itemName: "", quantity: 1 }],
                    })
                  }
                  className="text-amber-700 text-sm mt-2 hover:underline"
                >
                  + إضافة صنف آخر
                </button>
              </div>

              <Input
                label="ملاحظة"
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
              />

              <Button onClick={handleTransfer} loading={loading}>
                تنفيذ النقل
              </Button>
            </div>
          </Card>
        )}

        {tab === "count" && (
          <div className="space-y-4">
            <Card title="جرد جديد" actions={
              <Button size="sm" variant="outline" onClick={initCountForm}>
                تحميل الأصناف الحالية
              </Button>
            }>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <Input
                    label="التاريخ"
                    type="date"
                    value={countForm.date}
                    onChange={(e) => setCountForm({ ...countForm, date: e.target.value })}
                  />
                  <Input
                    label="الشهر"
                    type="month"
                    value={countForm.month}
                    onChange={(e) => setCountForm({ ...countForm, month: e.target.value })}
                  />
                </div>
                {countForm.countItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-600">
                          <th className="pb-2 font-medium">الصنف</th>
                          <th className="pb-2 font-medium">وحدة</th>
                          <th className="pb-2 font-medium">دفتري (رئيسي)</th>
                          <th className="pb-2 font-medium">فعلي (رئيسي)</th>
                          <th className="pb-2 font-medium">دفتري (محل)</th>
                          <th className="pb-2 font-medium">فعلي (محل)</th>
                          <th className="pb-2 font-medium">الفرق</th>
                        </tr>
                      </thead>
                      <tbody>
                        {countForm.countItems.map((ci, idx) => {
                          const diff = (ci.actualMain - ci.bookMain) + (ci.actualShop - ci.bookShop);
                          return (
                            <tr key={ci.itemId} className="border-b border-gray-50">
                              <td className="py-1.5 font-medium">{ci.itemName}</td>
                              <td className="py-1.5 text-gray-500">{ci.unit}</td>
                              <td className="py-1.5">{ci.bookMain}</td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                  value={ci.actualMain}
                                  onChange={(e) => {
                                    const updated = [...countForm.countItems];
                                    updated[idx].actualMain = Number(e.target.value);
                                    setCountForm({ ...countForm, countItems: updated });
                                  }}
                                />
                              </td>
                              <td className="py-1.5">{ci.bookShop}</td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                  value={ci.actualShop}
                                  onChange={(e) => {
                                    const updated = [...countForm.countItems];
                                    updated[idx].actualShop = Number(e.target.value);
                                    setCountForm({ ...countForm, countItems: updated });
                                  }}
                                />
                              </td>
                              <td className={`py-1.5 font-medium ${diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "text-gray-500"}`}>
                                {diff > 0 ? "+" : ""}{diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {countForm.countItems.length > 0 && (
                  <Button onClick={handleSaveCount} loading={loading}>
                    حفظ الجرد
                  </Button>
                )}
                {!countForm.countItems.length && (
                  <p className="text-gray-400 text-sm">اضغط "تحميل الأصناف الحالية" لبدء الجرد</p>
                )}
              </div>
            </Card>

            {counts.length > 0 && (
              <Card title="سجل الجرد السابق">
                <div className="space-y-2">
                  {counts.slice(0, 5).map((c: Record<string, unknown>) => (
                    <div key={c.id as string} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-sm">{c.date as string} — {c.month as string}</span>
                      <span className="text-xs text-gray-500">{(c.countItems as unknown[])?.length} صنف</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Item Modal */}
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title={editItem ? "تعديل صنف" : "إضافة صنف جديد"}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="اسم الصنف"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
          />
          <Select
            label="الوحدة"
            value={itemForm.unit}
            onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="مخزون (المخزن الرئيسي)"
              type="number"
              min={0}
              value={itemForm.stockMain}
              onChange={(e) => setItemForm({ ...itemForm, stockMain: Number(e.target.value) })}
            />
            <Input
              label="مخزون (المحل)"
              type="number"
              min={0}
              value={itemForm.stockShop}
              onChange={(e) => setItemForm({ ...itemForm, stockShop: Number(e.target.value) })}
            />
          </div>
          <Input
            label="حد التنبيه (إجمالي)"
            type="number"
            min={0}
            value={itemForm.lowStockThreshold}
            onChange={(e) => setItemForm({ ...itemForm, lowStockThreshold: Number(e.target.value) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setItemModal(false)}>إلغاء</Button>
            <Button onClick={saveItem} loading={loading}>
              {editItem ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
