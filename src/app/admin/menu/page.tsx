"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import {
  getMenuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory,
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  getItems,
} from "@/lib/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { MenuCategory, MenuItem, RecipeItem, Item } from "@/types";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const EMOJI_OPTIONS = ["🍚", "🥩", "🍗", "🥗", "🥤", "🍵", "🥙", "🧆", "🫕", "🍲", "🥘", "🍜", "🥞", "🍰", "🍟"];

type ItemForm = {
  name: string;
  categoryId: string;
  price: number;
  available: boolean;
  imageFile: File | null;
  imageUrl: string;
  recipe: RecipeItem[];
};

export default function AdminMenuPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"categories" | "items">("items");

  // Categories
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", order: 0, icon: "🍚" });

  // Menu Items
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<Item[]>([]);
  const [filterCat, setFilterCat] = useState("");
  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: "", categoryId: "", price: 0, available: true,
    imageFile: null, imageUrl: "", recipe: [],
  });
  const [loading, setLoading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Printer settings
  const [printerModal, setPrinterModal] = useState(false);
  const [printerForm, setPrinterForm] = useState({ cashierPrinter: "", kitchenPrinter: "" });

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/dashboard");
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  async function loadAll() {
    const [cats, its, stocks] = await Promise.all([
      getMenuCategories(),
      getMenuItems(),
      getItems(),
    ]);
    setCategories(cats as MenuCategory[]);
    setItems(its as MenuItem[]);
    setStockItems(stocks as Item[]);
  }

  // ── Categories ────────────────────────────────────────
  function openAddCat() {
    setEditCat(null);
    setCatForm({ name: "", order: categories.length, icon: "🍚" });
    setCatModal(true);
  }
  function openEditCat(c: MenuCategory) {
    setEditCat(c);
    setCatForm({ name: c.name, order: c.order, icon: c.icon });
    setCatModal(true);
  }
  async function saveCat() {
    if (!catForm.name.trim()) { toast.error("أدخل اسم القسم"); return; }
    setLoading(true);
    try {
      if (editCat) {
        await updateMenuCategory(editCat.id, catForm);
        toast.success("تم تحديث القسم");
      } else {
        await addMenuCategory(catForm);
        toast.success("تم إضافة القسم");
      }
      setCatModal(false);
      loadAll();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }
  async function deleteCat(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
    try {
      await deleteMenuCategory(id);
      toast.success("تم الحذف");
      loadAll();
    } catch { toast.error("حدث خطأ"); }
  }

  // ── Menu Items ────────────────────────────────────────
  function openAddItem() {
    setEditItem(null);
    setItemForm({ name: "", categoryId: categories[0]?.id || "", price: 0, available: true, imageFile: null, imageUrl: "", recipe: [] });
    setItemModal(true);
  }
  function openEditItem(it: MenuItem) {
    setEditItem(it);
    setItemForm({ name: it.name, categoryId: it.categoryId, price: it.price, available: it.available, imageFile: null, imageUrl: it.imageUrl || "", recipe: it.recipe || [] });
    setItemModal(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim()) { toast.error("أدخل اسم الصنف"); return; }
    if (!itemForm.categoryId) { toast.error("اختر القسم"); return; }
    if (itemForm.price < 0) { toast.error("السعر غير صحيح"); return; }
    if (itemForm.imageFile && itemForm.imageFile.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2MB"); return;
    }
    setLoading(true);
    try {
      const catName = categories.find((c) => c.id === itemForm.categoryId)?.name || "";
      const basePayload = {
        name: itemForm.name.trim(),
        categoryId: itemForm.categoryId,
        categoryName: catName,
        price: itemForm.price,
        available: itemForm.available,
        recipe: itemForm.recipe,
      };

      if (editItem) {
        // For existing items: upload image first (we already know the id), then update
        let imageUrl = itemForm.imageUrl;
        if (itemForm.imageFile) {
          const imgRef = ref(storage, `menu-images/${editItem.id}`);
          await uploadBytes(imgRef, itemForm.imageFile);
          imageUrl = await getDownloadURL(imgRef);
        }
        await updateMenuItem(editItem.id, { ...basePayload, imageUrl });
        toast.success("تم تحديث الصنف");
      } else {
        // For new items: create the doc first (no image), then upload image with the real id, then update
        const newRef = await addMenuItem({ ...basePayload, imageUrl: "" });
        const newId = (newRef as { id: string }).id;
        let imageUrl = "";
        if (itemForm.imageFile) {
          const imgRef = ref(storage, `menu-images/${newId}`);
          await uploadBytes(imgRef, itemForm.imageFile);
          imageUrl = await getDownloadURL(imgRef);
          await updateMenuItem(newId, { imageUrl });
        }
        toast.success("تم إضافة الصنف");
      }
      setItemModal(false);
      loadAll();
    } catch (e) { console.error(e); toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function deleteItem(it: MenuItem) {
    if (!confirm(`هل أنت متأكد من حذف "${it.name}"؟`)) return;
    try {
      await deleteMenuItem(it.id);
      if (it.imageUrl) {
        try { await deleteObject(ref(storage, `menu-images/${it.id}`)); } catch { /* ok */ }
      }
      toast.success("تم الحذف");
      loadAll();
    } catch { toast.error("حدث خطأ"); }
  }

  function addRecipeRow() {
    setItemForm((f) => ({ ...f, recipe: [...f.recipe, { itemId: "", itemName: "", quantityGrams: 0 }] }));
  }
  function removeRecipeRow(idx: number) {
    setItemForm((f) => ({ ...f, recipe: f.recipe.filter((_, i) => i !== idx) }));
  }
  function updateRecipeRow(idx: number, field: keyof RecipeItem, value: string | number) {
    setItemForm((f) => {
      const recipe = f.recipe.map((r, i) => {
        if (i !== idx) return r;
        if (field === "itemId") {
          const si = stockItems.find((s) => s.id === value);
          return { ...r, itemId: value as string, itemName: si?.name || "" };
        }
        return { ...r, [field]: value };
      });
      return { ...f, recipe };
    });
  }

  const displayedItems = filterCat ? items.filter((i) => i.categoryId === filterCat) : items;

  if (authLoading || !isAdmin) return null;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">قائمة الطعام</h1>
          <Button size="sm" variant="secondary" onClick={() => setPrinterModal(true)}>⚙ إعدادات الطابعة</Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {[{ key: "items", label: "الأصناف" }, { key: "categories", label: "الأقسام" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* ── Categories Tab ── */}
        {tab === "categories" && (
          <Card title={`الأقسام (${categories.length})`} actions={<Button size="sm" onClick={openAddCat}>+ إضافة قسم</Button>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">الترتيب</th>
                    <th className="pb-2 font-medium">الأيقونة</th>
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="py-2 text-center text-gray-500">{c.order}</td>
                      <td className="py-2 text-center text-2xl">{c.icon}</td>
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEditCat(c)} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                          <button onClick={() => deleteCat(c.id)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!categories.length && (
                    <tr><td colSpan={4} className="text-center text-gray-400 py-6">لا توجد أقسام بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Items Tab ── */}
        {tab === "items" && (
          <Card
            title={`الأصناف (${displayedItems.length})`}
            actions={
              <div className="flex gap-2 items-center">
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                >
                  <option value="">كل الأقسام</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <Button size="sm" onClick={openAddItem}>+ إضافة صنف</Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">الصورة</th>
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2 font-medium">القسم</th>
                    <th className="pb-2 font-medium">السعر</th>
                    <th className="pb-2 font-medium">الحالة</th>
                    <th className="pb-2 font-medium">الريسيبي</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((it) => (
                    <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="py-2">
                        {it.imageUrl
                          ? <img src={it.imageUrl} className="w-10 h-10 object-cover rounded-lg" alt={it.name} />
                          : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-lg">
                              {categories.find((c) => c.id === it.categoryId)?.icon || "🍽"}
                            </div>
                        }
                      </td>
                      <td className="py-2 font-medium">{it.name}</td>
                      <td className="py-2 text-gray-500">{it.categoryName}</td>
                      <td className="py-2 text-amber-700 font-medium">{formatCurrency(it.price)}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${it.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {it.available ? "متاح" : "غير متاح"}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 text-xs">{(it.recipe || []).length} مكوّن</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEditItem(it)} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                          <button onClick={() => deleteItem(it)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!displayedItems.length && (
                    <tr><td colSpan={7} className="text-center text-gray-400 py-6">لا توجد أصناف</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ── Category Modal ── */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={editCat ? "تعديل قسم" : "إضافة قسم"} size="sm">
        <div className="space-y-4">
          <Input label="اسم القسم" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          <Input label="الترتيب" type="number" min={0} value={catForm.order} onChange={(e) => setCatForm({ ...catForm, order: Number(e.target.value) })} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الأيقونة</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => setCatForm({ ...catForm, icon: e })}
                  className={`text-2xl p-1.5 rounded-lg transition-all ${catForm.icon === e ? "bg-yellow-100 ring-2 ring-yellow-400" : "hover:bg-gray-100 dark:hover:bg-slate-700"}`}
                >{e}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCatModal(false)}>إلغاء</Button>
            <Button onClick={saveCat} loading={loading}>{editCat ? "تحديث" : "إضافة"}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Item Modal ── */}
      <Modal open={itemModal} onClose={() => setItemModal(false)} title={editItem ? "تعديل صنف" : "إضافة صنف"} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Input label="اسم الصنف" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            <Input label="السعر (ج.م)" type="number" min={0} value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="القسم" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
              <option value="">اختر قسم</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemForm.available} onChange={(e) => setItemForm({ ...itemForm, available: e.target.checked })}
                  className="w-4 h-4 accent-yellow-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">متاح للبيع</span>
              </label>
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">صورة الصنف (اختياري)</label>
            <div className="flex items-center gap-3">
              {(itemForm.imageUrl || itemForm.imageFile) && (
                <img
                  src={itemForm.imageFile ? URL.createObjectURL(itemForm.imageFile) : itemForm.imageUrl}
                  className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-slate-600"
                  alt="preview"
                />
              )}
              <div className="flex-1">
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setItemForm((prev) => ({ ...prev, imageFile: f }));
                  }}
                />
                <Button size="sm" variant="secondary" onClick={() => imgInputRef.current?.click()}>اختر صورة</Button>
                {(itemForm.imageUrl || itemForm.imageFile) && (
                  <button onClick={() => setItemForm((f) => ({ ...f, imageFile: null, imageUrl: "" }))}
                    className="mr-2 text-xs text-red-500 hover:underline">حذف الصورة</button>
                )}
                <p className="text-xs text-gray-400 mt-1">الحد الأقصى: 2MB</p>
              </div>
            </div>
          </div>

          {/* Recipe Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">الريسيبي (المكونات من مخزون المحل)</label>
              <Button size="sm" variant="secondary" onClick={addRecipeRow}>+ إضافة مكوّن</Button>
            </div>
            {itemForm.recipe.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500">لا يوجد ريسيبي — لن يتم خصم أي مخزون عند البيع</p>
            )}
            {itemForm.recipe.map((r, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={r.itemId}
                  onChange={(e) => updateRecipeRow(idx, "itemId", e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                >
                  <option value="">اختر صنف مخزون</option>
                  {stockItems.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                </select>
                <div className="w-28">
                  <Input
                    label=""
                    type="number"
                    min={0}
                    value={r.quantityGrams}
                    onChange={(e) => updateRecipeRow(idx, "quantityGrams", Number(e.target.value))}
                    placeholder="جرام"
                  />
                </div>
                <span className="text-xs text-gray-400 shrink-0">ج</span>
                <button onClick={() => removeRecipeRow(idx)} className="text-red-400 hover:text-red-600 text-lg shrink-0">×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-700 mt-4">
          <Button variant="secondary" onClick={() => setItemModal(false)}>إلغاء</Button>
          <Button onClick={saveItem} loading={loading}>{editItem ? "تحديث" : "إضافة"}</Button>
        </div>
      </Modal>

      {/* ── Printer Settings Modal ── */}
      <Modal open={printerModal} onClose={() => setPrinterModal(false)} title="إعدادات الطابعة" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            أدخل اسم الطابعة كما يظهر في ويندوز (Control Panel → Devices and Printers)
          </p>
          <Input
            label="طابعة الكاشير (الإيصال)"
            value={printerForm.cashierPrinter}
            onChange={(e) => setPrinterForm({ ...printerForm, cashierPrinter: e.target.value })}
            placeholder="مثال: EPSON TM-T20"
          />
          <Input
            label="طابعة المطبخ (التذكرة)"
            value={printerForm.kitchenPrinter}
            onChange={(e) => setPrinterForm({ ...printerForm, kitchenPrinter: e.target.value })}
            placeholder="مثال: Kitchen Printer"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPrinterModal(false)}>إلغاء</Button>
            <Button onClick={async () => {
              try {
                const { setDoc, doc } = await import("firebase/firestore");
                const { db } = await import("@/lib/firebase");
                await setDoc(doc(db, "appSettings", "printers"), printerForm, { merge: true });
                toast.success("تم حفظ إعدادات الطابعة");
                setPrinterModal(false);
              } catch { toast.error("حدث خطأ"); }
            }}>حفظ</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
