// QZ Tray integration for silent thermal printing.
// Requires QZ Tray desktop app installed on the cashier PC.
// Printer names are fetched from appSettings/printers in Firestore.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qz: any;
  }
}

export type PrinterConfig = {
  cashierPrinter: string;
  kitchenPrinter: string;
};

let connected = false;

export async function loadQZTray(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.qz) return true;

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/gh/qzind/tray@2.2.4/js/qz-tray.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function connectQZ(): Promise<boolean> {
  if (connected) return true;
  try {
    const loaded = await loadQZTray();
    if (!loaded || !window.qz) return false;

    // Disable certificate checking for internal/restaurant use.
    // QZ Tray must have "Allow unsigned requests" enabled in its preferences.
    window.qz.security.setCertificatePromise(() => Promise.resolve(""));
    window.qz.security.setSignatureAlgorithm("SHA512");
    window.qz.security.setSignaturePromise(() => Promise.resolve(""));

    if (!window.qz.websocket.isActive()) {
      await window.qz.websocket.connect();
    }
    connected = true;
    return true;
  } catch {
    connected = false;
    return false;
  }
}

export async function disconnectQZ() {
  try {
    if (window.qz?.websocket?.isActive()) {
      await window.qz.websocket.disconnect();
    }
  } catch {
    // ignore
  }
  connected = false;
}

export function isQZConnected(): boolean {
  return connected && typeof window !== "undefined" && window.qz?.websocket?.isActive();
}

export async function printToQZ(printerName: string, html: string): Promise<void> {
  if (!isQZConnected()) throw new Error("QZ Tray غير متصل");
  const config = window.qz.configs.create(printerName, {
    size: { width: 80, units: "mm" },
    margins: { top: 3, right: 3, bottom: 3, left: 3, units: "mm" },
  });
  const data = [{ type: "html", format: "plain", data: html }];
  await window.qz.print(config, data);
}

// Build the cashier receipt HTML (RTL, Arabic)
export function buildCashierReceipt(order: {
  orderNumber: number;
  items: { name: string; qty: number; price: number; total: number }[];
  total: number;
  notes: string;
  paymentMethod: "cash" | "card" | "wallet";
  restaurantName?: string;
}): string {
  const methodLabel = { cash: "نقدي", card: "بطاقة", wallet: "محفظة" }[order.paymentMethod];
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ar-EG");
  const name = order.restaurantName || "راية الشام";

  const rows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="text-align:right">${i.name}</td>
          <td style="text-align:center">×${i.qty}</td>
          <td style="text-align:left">${i.total} ج.م</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; width: 72mm; }
  h2 { text-align: center; font-size: 16px; margin-bottom: 2px; }
  .center { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
  .total { font-size: 14px; font-weight: bold; }
  .footer { text-align: center; margin-top: 6px; font-size: 11px; }
</style>
</head>
<body>
  <h2>${name}</h2>
  <p class="center">${dateStr} — ${timeStr}</p>
  <p class="center">طلب رقم: <strong>#${order.orderNumber}</strong></p>
  <div class="sep"></div>
  <table>
    <tbody>${rows}</tbody>
  </table>
  <div class="sep"></div>
  <table>
    <tr>
      <td class="total">الإجمالي:</td>
      <td class="total" style="text-align:left">${order.total} ج.م</td>
    </tr>
    <tr>
      <td>طريقة الدفع:</td>
      <td style="text-align:left">${methodLabel}</td>
    </tr>
  </table>
  ${order.notes ? `<div class="sep"></div><p>ملاحظات: ${order.notes}</p>` : ""}
  <div class="sep"></div>
  <p class="footer">شكراً لزيارتكم</p>
</body>
</html>`;
}

// Build the kitchen ticket HTML
export function buildKitchenTicket(order: {
  orderNumber: number;
  items: { name: string; qty: number }[];
  notes: string;
}): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const rows = order.items
    .map((i) => `<tr><td style="text-align:right">${i.name}</td><td style="text-align:left; font-size:16px; font-weight:bold">×${i.qty}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 14px; width: 72mm; }
  h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
  .center { text-align: center; font-size: 13px; }
  .sep { border-top: 2px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; font-size: 15px; }
  .notes { margin-top: 6px; font-size: 13px; border: 1px solid #000; padding: 4px; }
</style>
</head>
<body>
  <h2>طلب #${order.orderNumber}</h2>
  <p class="center">${timeStr}</p>
  <div class="sep"></div>
  <table><tbody>${rows}</tbody></table>
  ${order.notes ? `<div class="notes">⚠ ${order.notes}</div>` : ""}
  <div class="sep"></div>
</body>
</html>`;
}
