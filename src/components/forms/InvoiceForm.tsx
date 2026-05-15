"use client";
import { useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { InvoiceItem } from "@/types";
import { Timestamp } from "firebase/firestore";

interface InvoiceFormProps {
  type: "supplier" | "customer";
  parties: { id: string; name: string }[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initialValues?: {
    partyId: string;
    partyName: string;
    date: string;
    dueDate: string;
    receivingWarehouse: "main" | "shop";
    note: string;
    items: InvoiceItem[];
  };
  submitLabel?: string;
}

export default function InvoiceForm({ type, parties, onSubmit, onCancel, initialValues, submitLabel }: InvoiceFormProps) {
  const [partyId, setPartyId] = useState(initialValues?.partyId ?? "");
  const [partyName, setPartyName] = useState(initialValues?.partyName ?? "");
  const [date, setDate] = useState(initialValues?.date ?? new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
  const [receivingWarehouse, setReceivingWarehouse] = useState<"main" | "shop">(initialValues?.receivingWarehouse ?? "main");
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [items, setItems] = useState<InvoiceItem[]>(initialValues?.items ?? [
    { name: "", unit: "كغ", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    const updated = [...items];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
    }
    setItems(updated);
  }

  function addRow() {
    setItems([...items, { name: "", unit: "كغ", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  async function handleSubmit() {
    if (!partyId) return;
    if (items.some((i) => !i.name.trim())) return;
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        date: Timestamp.fromDate(new Date(date)),
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : Timestamp.fromDate(new Date(date)),
        items,
        totalAmount,
        note,
      };
      if (type === "supplier") {
        data.supplierId = partyId;
        data.supplierName = partyName;
        data.receivingWarehouse = receivingWarehouse;
      } else {
        data.customerId = partyId;
        data.customerName = partyName;
      }
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            {type === "supplier" ? "المورد" : "العميل"}
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setPartyName(parties.find((p) => p.id === e.target.value)?.name || "");
            }}
          >
            <option value="">اختر {type === "supplier" ? "المورد" : "العميل"}</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="التاريخ"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label="تاريخ الاستحقاق"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {type === "supplier" && (
          <Select
            label="المخزن المستلَم"
            value={receivingWarehouse}
            onChange={(e) => setReceivingWarehouse(e.target.value as "main" | "shop")}
          >
            <option value="main">المخزن الرئيسي</option>
            <option value="shop">المحل</option>
          </Select>
        )}
      </div>

      {/* Items table */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">الأصناف</label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-right font-medium rounded-r-lg">الاسم</th>
                <th className="px-3 py-2 text-right font-medium">الوحدة</th>
                <th className="px-3 py-2 text-right font-medium">الكمية</th>
                <th className="px-3 py-2 text-right font-medium">سعر الوحدة</th>
                <th className="px-3 py-2 text-right font-medium">الإجمالي</th>
                <th className="px-3 py-2 rounded-l-lg"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-1.5 px-1">
                    <input
                      className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded px-2 py-1.5 text-sm"
                      value={item.name}
                      onChange={(e) => updateItem(idx, "name", e.target.value)}
                      placeholder="اسم الصنف"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      className="w-20 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded px-2 py-1.5 text-sm"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, "unit", e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      type="number"
                      min={0}
                      className="w-20 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded px-2 py-1.5 text-sm"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      type="number"
                      min={0}
                      className="w-28 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded px-2 py-1.5 text-sm"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    />
                  </td>
                  <td className="py-1.5 px-2 font-medium text-amber-700 whitespace-nowrap">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="py-1.5 px-1">
                    {items.length > 1 && (
                      <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-3 px-2 text-left font-semibold text-gray-700">المجموع الكلي:</td>
                <td className="pt-3 px-2 font-bold text-amber-700 text-base">{formatCurrency(totalAmount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={addRow} className="text-amber-700 text-sm mt-2 hover:underline">
          + إضافة صنف
        </button>
      </div>

      <Textarea
        label="ملاحظة"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="أي ملاحظات على الفاتورة..."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
        <Button onClick={handleSubmit} loading={loading} disabled={!partyId}>
          {submitLabel ?? "حفظ الفاتورة"}
        </Button>
      </div>
    </div>
  );
}
