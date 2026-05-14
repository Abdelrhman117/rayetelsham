import { NextRequest, NextResponse } from "next/server";
import { getDoc, doc, getFirestore } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

function formatDateStr(ts: { toDate?: () => Date } | null): string {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date();
  return d.toLocaleDateString("ar-SY", { year: "numeric", month: "long", day: "numeric" });
}

function buildInvoiceHTML(invoice: Record<string, unknown>, type: "supplier" | "customer"): string {
  const party =
    type === "supplier"
      ? `المورد: ${invoice.supplierName}`
      : `العميل: ${invoice.customerName}`;

  const items = (invoice.items as { name: string; unit: string; quantity: number; unitPrice: number; total: number }[]) || [];

  const rows = items
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.unit}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unitPrice)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join("");

  const date = formatDateStr(invoice.date as { toDate?: () => Date });
  const dueDate = formatDateStr(invoice.dueDate as { toDate?: () => Date });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; direction: rtl; }
  h1 { color: #92400e; margin: 0; font-size: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #92400e; padding-bottom: 20px; }
  .logo { font-size: 48px; }
  .company { text-align: right; }
  .company p { margin: 2px 0; font-size: 13px; color: #666; }
  .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
  .info-box { background: #fef3c7; border-radius: 8px; padding: 15px; }
  .info-box h3 { margin: 0 0 10px; font-size: 14px; color: #92400e; }
  .info-box p { margin: 3px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #92400e; color: white; padding: 10px 12px; text-align: right; font-size: 13px; }
  td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  tr:nth-child(even) td { background: #fafaf9; }
  .total-row { background: #fef3c7 !important; font-weight: bold; font-size: 15px; }
  .total-row td { border-top: 2px solid #92400e; }
  .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-unpaid { background: #fee2e2; color: #991b1b; }
  .status-partial { background: #fef3c7; color: #92400e; }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <h1>🥙 رايا الشام</h1>
    <p>مطعم الشاورما السوري الأصيل</p>
    <p>هاتف: +963 XXX XXX XXX</p>
  </div>
  <div>
    <p style="font-size:18px; font-weight:bold; color:#92400e;">${type === "supplier" ? "فاتورة شراء" : "فاتورة بيع"}</p>
    <p style="font-size:14px; color:#666;">رقم: ${invoice.invoiceNumber}</p>
    <p style="font-size:13px; color:#666;">التاريخ: ${date}</p>
  </div>
</div>

<div class="invoice-info">
  <div class="info-box">
    <h3>${type === "supplier" ? "معلومات المورد" : "معلومات العميل"}</h3>
    <p>${party}</p>
  </div>
  <div class="info-box">
    <h3>تفاصيل الفاتورة</h3>
    <p>تاريخ الاستحقاق: ${dueDate}</p>
    <p>الحالة: <span class="status status-${invoice.status}">${
      invoice.status === "paid" ? "مدفوع" : invoice.status === "partial" ? "جزئي" : "غير مدفوع"
    }</span></p>
    ${type === "supplier" ? `<p>المخزن: ${(invoice.receivingWarehouse as string) === "main" ? "المخزن الرئيسي" : "المحل"}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>الصنف</th>
      <th>الوحدة</th>
      <th>الكمية</th>
      <th>سعر الوحدة</th>
      <th>الإجمالي</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="4">المجموع الكلي</td>
      <td>${formatCurrency(invoice.totalAmount as number)}</td>
    </tr>
    <tr style="background:#f9fafb">
      <td colspan="4">المدفوع</td>
      <td style="color:#059669">${formatCurrency(invoice.paidAmount as number)}</td>
    </tr>
    <tr style="background:#f9fafb">
      <td colspan="4" style="font-weight:bold">المتبقي</td>
      <td style="font-weight:bold; color:#dc2626">${formatCurrency((invoice.totalAmount as number) - (invoice.paidAmount as number))}</td>
    </tr>
  </tbody>
</table>

${invoice.note ? `<div style="margin-top:20px; padding:12px; background:#f9fafb; border-radius:8px; font-size:13px; color:#666;"><strong>ملاحظة:</strong> ${invoice.note}</div>` : ""}

<div class="footer">
  <p>شكراً لتعاملكم مع رايا الشام 🥙</p>
  <p>تم إنشاء هذه الفاتورة إلكترونياً — ${new Date().toLocaleDateString("ar-SY")}</p>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { invoiceId, type } = await req.json();

    if (!invoiceId || !type) {
      return NextResponse.json({ error: "Missing invoiceId or type" }, { status: 400 });
    }

    const collection = type === "supplier" ? "supplierInvoices" : "salesInvoices";
    const invoiceDoc = await getDoc(doc(db, collection, invoiceId));

    if (!invoiceDoc.exists()) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };
    const html = buildInvoiceHTML(invoice, type);

    // Convert HTML to PDF using a simple text-based PDF approach with pdf-lib
    // For production, consider using puppeteer or a cloud HTML-to-PDF service
    // Here we store the HTML as a .html file and provide a URL; or we encode it
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);

    const filename = `invoices/${invoiceId}.html`;
    const storageRef = ref(storage, filename);

    await uploadBytes(storageRef, htmlBytes, {
      contentType: "text/html; charset=utf-8",
    });

    const url = await getDownloadURL(storageRef);

    return NextResponse.json({ url, success: true });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
