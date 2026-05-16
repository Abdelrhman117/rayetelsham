import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  increment,
  setDoc,
  limit,
  runTransaction,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

// Generic collection helper
export const col = (name: string) => collection(db, name);
export const docRef = (colName: string, id: string) => doc(db, colName, id);

// Generate invoice number (with uniqueness retry)
export async function generateInvoiceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const colName = prefix === "SUP" ? "supplierInvoices" : "salesInvoices";

  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const candidate = `${prefix}-${year}${month}-${rand}`;
    const snap = await getDocs(query(col(colName), where("invoiceNumber", "==", candidate), limit(1)));
    if (snap.empty) return candidate;
  }
  return `${prefix}-${year}${month}-${Date.now()}`;
}

// Items
export async function getItems() {
  const snap = await getDocs(query(col("items"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addItem(data: Record<string, unknown>) {
  return addDoc(col("items"), { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
}

export async function updateItem(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("items", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteItem(id: string) {
  return deleteDoc(docRef("items", id));
}

// Transfer stock between warehouses
export async function transferStock(transfer: {
  fromWarehouse: "main" | "shop";
  toWarehouse: "main" | "shop";
  items: { itemId: string; itemName: string; quantity: number }[];
  note: string;
}) {
  const fromField = transfer.fromWarehouse === "main" ? "stockMain" : "stockShop";
  const toField   = transfer.toWarehouse   === "main" ? "stockMain" : "stockShop";

  // Validate all stock levels before committing
  const snaps = await Promise.all(transfer.items.map((i) => getDoc(docRef("items", i.itemId))));
  for (let i = 0; i < transfer.items.length; i++) {
    const item = transfer.items[i];
    const snap = snaps[i];
    if (!snap.exists()) throw new Error(`الصنف "${item.itemName}" غير موجود`);
    const available = (snap.data()[fromField] as number) || 0;
    if (available < item.quantity) {
      throw new Error(
        `المخزون غير كافٍ للصنف "${item.itemName}" — المتوفر: ${available}، المطلوب: ${item.quantity}`
      );
    }
  }

  const batch = writeBatch(db);
  for (const item of transfer.items) {
    batch.update(docRef("items", item.itemId), {
      [fromField]: increment(-item.quantity),
      [toField]: increment(item.quantity),
      updatedAt: Timestamp.now(),
    });
  }

  const transferRef = doc(col("transfers"));
  batch.set(transferRef, { ...transfer, date: Timestamp.now(), createdAt: Timestamp.now() });

  await batch.commit();
  return transferRef.id;
}

// Suppliers
export async function getSuppliers() {
  const snap = await getDocs(query(col("suppliers"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSupplier(data: Record<string, unknown>) {
  return addDoc(col("suppliers"), { ...data, createdAt: Timestamp.now() });
}

export async function updateSupplier(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("suppliers", id), data);
}

export async function deleteSupplier(id: string) {
  return deleteDoc(docRef("suppliers", id));
}

// Supplier Invoices
export async function getSupplierInvoices(supplierId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (supplierId) constraints.unshift(where("supplierId", "==", supplierId));
  const snap = await getDocs(query(col("supplierInvoices"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSupplierInvoice(data: Record<string, unknown>) {
  const invoiceNumber = await generateInvoiceNumber("SUP");
  const ref = await addDoc(col("supplierInvoices"), {
    ...data,
    invoiceNumber,
    paidAmount: 0,
    status: "unpaid",
    pdfUrl: "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Sync stock: update existing items or create new ones
  const items = data.items as { name: string; unit: string; quantity: number }[];
  const warehouse = data.receivingWarehouse as "main" | "shop";
  const stockField = warehouse === "main" ? "stockMain" : "stockShop";
  const otherField = warehouse === "main" ? "stockShop" : "stockMain";

  const itemsSnap = await getDocs(col("items"));
  const batch = writeBatch(db);

  for (const invoiceItem of items) {
    const existing = itemsSnap.docs.find(
      (d) => d.data().name.toLowerCase() === invoiceItem.name.toLowerCase()
    );
    if (existing) {
      batch.update(existing.ref, {
        [stockField]: increment(invoiceItem.quantity),
        updatedAt: Timestamp.now(),
      });
    } else {
      const newItemRef = doc(col("items"));
      batch.set(newItemRef, {
        name: invoiceItem.name,
        unit: invoiceItem.unit || "",
        [stockField]: invoiceItem.quantity,
        [otherField]: 0,
        lowStockThreshold: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  await batch.commit();

  return ref;
}

export async function updateSupplierInvoice(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("supplierInvoices", id), { ...data, updatedAt: Timestamp.now() });
}

// Supplier Payments
export async function addSupplierPayment(data: {
  supplierId: string;
  supplierName: string;
  invoiceIds: string[];
  amount: number;
  date: Timestamp;
  note: string;
}) {
  // Fetch all invoices in parallel (avoid N+1 reads)
  const invSnaps = await Promise.all(
    data.invoiceIds.map((id) => getDoc(docRef("supplierInvoices", id)))
  );

  const batch = writeBatch(db);
  const payRef = doc(col("supplierPayments"));
  batch.set(payRef, { ...data, createdAt: Timestamp.now() });

  let remaining = data.amount;
  for (const invSnap of invSnaps) {
    if (remaining <= 0) break;
    if (!invSnap.exists()) continue;
    const inv = invSnap.data();
    const due = inv.totalAmount - inv.paidAmount;
    const payment = Math.min(remaining, due);
    remaining -= payment;
    const newPaid = inv.paidAmount + payment;
    const newStatus = newPaid >= inv.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    batch.update(invSnap.ref, { paidAmount: newPaid, status: newStatus, updatedAt: Timestamp.now() });
  }

  await batch.commit();
  return payRef.id;
}

// Customers
export async function getCustomers() {
  const snap = await getDocs(query(col("customers"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addCustomer(data: Record<string, unknown>) {
  return addDoc(col("customers"), { ...data, createdAt: Timestamp.now() });
}

export async function updateCustomer(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("customers", id), data);
}

export async function deleteCustomer(id: string) {
  return deleteDoc(docRef("customers", id));
}

// Sales Invoices
export async function getSalesInvoices(customerId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (customerId) constraints.unshift(where("customerId", "==", customerId));
  const snap = await getDocs(query(col("salesInvoices"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSalesInvoice(data: Record<string, unknown>) {
  const invoiceNumber = await generateInvoiceNumber("SAL");
  return addDoc(col("salesInvoices"), {
    ...data,
    invoiceNumber,
    paidAmount: 0,
    status: "unpaid",
    pdfUrl: "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateSalesInvoice(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("salesInvoices", id), { ...data, updatedAt: Timestamp.now() });
}

// Customer Payments
export async function addCustomerPayment(data: {
  customerId: string;
  customerName: string;
  invoiceIds: string[];
  amount: number;
  date: Timestamp;
  note: string;
}) {
  const batch = writeBatch(db);
  const payRef = doc(col("customerPayments"));
  batch.set(payRef, { ...data, createdAt: Timestamp.now() });

  let remaining = data.amount;
  for (const invId of data.invoiceIds) {
    if (remaining <= 0) break;
    const invRef = docRef("salesInvoices", invId);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) continue;
    const inv = invSnap.data();
    const due = inv.totalAmount - inv.paidAmount;
    const payment = Math.min(remaining, due);
    remaining -= payment;
    const newPaid = inv.paidAmount + payment;
    const newStatus = newPaid >= inv.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    batch.update(invRef, { paidAmount: newPaid, status: newStatus, updatedAt: Timestamp.now() });
  }

  await batch.commit();
  return payRef.id;
}

// Daily Sales
export async function getDailySales(startDate?: string, endDate?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (startDate) constraints.push(where("date", ">=", startDate));
  if (endDate) constraints.push(where("date", "<=", endDate));
  const snap = await getDocs(query(col("dailySales"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setDailySale(date: string, data: Record<string, unknown>) {
  const ref = docRef("dailySales", date);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
  }
  return setDoc(ref, { ...data, date, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
}

// Expenses
export async function getExpenses(startDate?: string, endDate?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (startDate) constraints.push(where("date", ">=", startDate));
  if (endDate) constraints.push(where("date", "<=", endDate));
  const snap = await getDocs(query(col("expenses"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addExpense(data: Record<string, unknown>) {
  return addDoc(col("expenses"), { ...data, createdAt: Timestamp.now() });
}

export async function updateExpense(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("expenses", id), data);
}

export async function deleteExpense(id: string) {
  return deleteDoc(docRef("expenses", id));
}

// Employees
export async function getEmployees() {
  const snap = await getDocs(query(col("employees"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addEmployee(data: Record<string, unknown>) {
  return addDoc(col("employees"), { ...data, createdAt: Timestamp.now() });
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("employees", id), data);
}

export async function deleteEmployee(id: string) {
  return deleteDoc(docRef("employees", id));
}

// Salary Records
export async function getSalaryRecords(date?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (date) constraints.unshift(where("date", "==", date));
  const snap = await getDocs(query(col("salaries"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setSalaryRecord(
  date: string,
  employeeId: string,
  data: Record<string, unknown>,
  worked?: boolean
) {
  const existing = await getDocs(
    query(col("salaries"), where("date", "==", date), where("employeeId", "==", employeeId))
  );
  if (worked === false) {
    // Remove record if employee didn't work
    if (!existing.empty) return deleteDoc(existing.docs[0].ref);
    return;
  }
  if (!existing.empty) {
    return updateDoc(existing.docs[0].ref, data);
  }
  return addDoc(col("salaries"), { ...data, date, employeeId, createdAt: Timestamp.now() });
}

// Inventory Counts
export async function getInventoryCounts() {
  const snap = await getDocs(query(col("inventoryCounts"), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addInventoryCount(data: Record<string, unknown>) {
  return addDoc(col("inventoryCounts"), { ...data, createdAt: Timestamp.now() });
}

// =====================================================
// DEDUCTIONS (خصومات)
// =====================================================

export async function getDeductions(employeeId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (employeeId) constraints.unshift(where("employeeId", "==", employeeId));
  const snap = await getDocs(query(col("deductions"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addDeduction(data: Record<string, unknown>) {
  return addDoc(col("deductions"), { ...data, createdAt: Timestamp.now() });
}

export async function updateDeduction(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("deductions", id), data);
}

export async function deleteDeduction(id: string) {
  return deleteDoc(docRef("deductions", id));
}

// =====================================================
// ADVANCES / LOANS (سلف)
// =====================================================

export async function getAdvances(employeeId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (employeeId) constraints.unshift(where("employeeId", "==", employeeId));
  const snap = await getDocs(query(col("advances"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addAdvance(data: Record<string, unknown>) {
  return addDoc(col("advances"), {
    ...data,
    repaidAmount: 0,
    status: "active",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateAdvance(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("advances", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteAdvance(id: string) {
  return deleteDoc(docRef("advances", id));
}

export async function repayAdvance(advanceId: string, paymentAmount: number, date: string, note: string) {
  const advanceRef = docRef("advances", advanceId);
  const advSnap = await getDoc(advanceRef);
  if (!advSnap.exists()) throw new Error("Advance not found");

  const adv = advSnap.data();
  // Round to avoid floating-point issues (e.g. 100.0000001 >= 100)
  const newRepaid = Math.round(((adv.repaidAmount || 0) + paymentAmount) * 100) / 100;
  const newStatus = newRepaid >= adv.amount ? "repaid" : "partial";

  const batch = writeBatch(db);

  // Record the payment
  const payRef = doc(col("advancePayments"));
  batch.set(payRef, {
    advanceId,
    employeeId: adv.employeeId,
    employeeName: adv.employeeName,
    amount: paymentAmount,
    date,
    note,
    createdAt: Timestamp.now(),
  });

  // Update advance balance
  batch.update(advanceRef, {
    repaidAmount: newRepaid,
    status: newStatus,
    updatedAt: Timestamp.now(),
  });

  await batch.commit();
  return payRef.id;
}

export async function getAdvancePayments(advanceId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (advanceId) constraints.unshift(where("advanceId", "==", advanceId));
  const snap = await getDocs(query(col("advancePayments"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Supplier Returns
export async function getSupplierReturns(invoiceId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (invoiceId) constraints.unshift(where("invoiceId", "==", invoiceId));
  const snap = await getDocs(query(col("supplierReturns"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSupplierReturn(data: {
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  returnType: "goods" | "credit";
  items: { name: string; unit: string; quantity: number; unitPrice: number; total: number }[];
  creditAmount: number;
  totalAmount: number;
  warehouse: "main" | "shop";
  note: string;
}) {
  const batch = writeBatch(db);

  // 1. Create return record
  const returnRef = doc(col("supplierReturns"));
  batch.set(returnRef, { ...data, createdAt: Timestamp.now() });

  // 2. Update the original invoice
  const invRef = docRef("supplierInvoices", data.invoiceId);
  const invSnap = await getDoc(invRef);
  if (invSnap.exists()) {
    const inv = invSnap.data();
    if (data.returnType === "goods") {
      const itemsSnap = await getDocs(col("items"));
      const stockField = data.warehouse === "main" ? "stockMain" : "stockShop";

      // Validate stock before deducting
      for (const retItem of data.items) {
        const existing = itemsSnap.docs.find(
          (d) => d.data().name.toLowerCase() === retItem.name.toLowerCase()
        );
        if (existing) {
          const available = (existing.data()[stockField] as number) || 0;
          if (available < retItem.quantity) {
            throw new Error(
              `المخزون غير كافٍ للصنف "${retItem.name}" — المتوفر: ${available}، المطلوب: ${retItem.quantity}`
            );
          }
        }
      }

      // Reduce totalAmount by return value
      const newTotal = Math.max(0, (inv.totalAmount || 0) - data.totalAmount);
      const newStatus = inv.paidAmount >= newTotal ? "paid" : inv.paidAmount > 0 ? "partial" : "unpaid";
      batch.update(invRef, { totalAmount: newTotal, status: newStatus, updatedAt: Timestamp.now() });

      // Deduct stock from warehouse
      for (const retItem of data.items) {
        const existing = itemsSnap.docs.find(
          (d) => d.data().name.toLowerCase() === retItem.name.toLowerCase()
        );
        if (existing) {
          batch.update(existing.ref, {
            [stockField]: increment(-retItem.quantity),
            updatedAt: Timestamp.now(),
          });
        }
      }
    } else {
      // credit: increase paidAmount
      const newPaid = (inv.paidAmount || 0) + data.creditAmount;
      const newStatus = newPaid >= inv.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      batch.update(invRef, { paidAmount: newPaid, status: newStatus, updatedAt: Timestamp.now() });
    }
  }

  await batch.commit();
  return returnRef.id;
}

export async function deleteSupplierInvoice(id: string) {
  return deleteDoc(docRef("supplierInvoices", id));
}

// =====================================================
// BONUSES (مكافآت)
// =====================================================

export async function getBonuses(employeeId?: string) {
  const constraints: QueryConstraint[] = [orderBy("date", "desc")];
  if (employeeId) constraints.unshift(where("employeeId", "==", employeeId));
  const snap = await getDocs(query(col("bonuses"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addBonus(data: Record<string, unknown>) {
  return addDoc(col("bonuses"), { ...data, createdAt: Timestamp.now() });
}

export async function deleteBonus(id: string) {
  return deleteDoc(docRef("bonuses", id));
}

// =====================================================
// MENU CATEGORIES (أقسام المنيو)
// =====================================================

export async function getMenuCategories() {
  const snap = await getDocs(query(col("menuCategories"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMenuCategory(data: Record<string, unknown>) {
  return addDoc(col("menuCategories"), { ...data, createdAt: Timestamp.now() });
}

export async function updateMenuCategory(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("menuCategories", id), data);
}

export async function deleteMenuCategory(id: string) {
  return deleteDoc(docRef("menuCategories", id));
}

// =====================================================
// MENU ITEMS (أصناف المنيو)
// =====================================================

export async function getMenuItems(categoryId?: string) {
  const constraints: QueryConstraint[] = [orderBy("name")];
  if (categoryId) constraints.unshift(where("categoryId", "==", categoryId));
  const snap = await getDocs(query(col("menuItems"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMenuItem(data: Record<string, unknown>) {
  return addDoc(col("menuItems"), { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
}

export async function updateMenuItem(id: string, data: Record<string, unknown>) {
  return updateDoc(docRef("menuItems", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteMenuItem(id: string) {
  return deleteDoc(docRef("menuItems", id));
}

// =====================================================
// ORDERS (الطلبات)
// =====================================================

export async function createOrder(data: {
  items: { menuItemId: string; name: string; qty: number; price: number; total: number }[];
  total: number;
  notes: string;
  paymentMethod: "cash" | "card" | "wallet";
  cashierEmail: string;
}): Promise<{ id: string; orderNumber: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const counterRef = docRef("appSettings", "orderCounter");

  // Step 1: Atomic order number increment
  let orderNumber = 1;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (snap.exists()) {
      const d = snap.data();
      orderNumber = d.lastDate === today ? (d.dailyCounter || 0) + 1 : 1;
    }
    tx.set(counterRef, { dailyCounter: orderNumber, lastDate: today }, { merge: true });
  });

  // Step 2: Collect all menu item refs to read inside the stock transaction
  const menuItemIds = [...new Set(data.items.map((i) => i.menuItemId))];

  // Step 3: Stock deduction + order creation (single transaction)
  const orderRef = doc(col("orders"));
  await runTransaction(db, async (tx) => {
    // Read all menu items
    const menuSnaps = await Promise.all(menuItemIds.map((id) => tx.get(docRef("menuItems", id))));
    const menuMap = new Map(menuSnaps.map((s) => [s.id, s]));

    // Build deduction map: itemId → total grams to deduct
    const deductions = new Map<string, { ref: ReturnType<typeof docRef>; grams: number; name: string }>();
    for (const oi of data.items) {
      const menuSnap = menuMap.get(oi.menuItemId);
      if (!menuSnap || !menuSnap.exists()) throw new Error(`الصنف "${oi.name}" غير موجود في المنيو`);
      const recipe = (menuSnap.data().recipe || []) as { itemId: string; itemName: string; quantityGrams: number }[];
      for (const r of recipe) {
        const existing = deductions.get(r.itemId);
        const totalGrams = r.quantityGrams * oi.qty;
        if (existing) {
          existing.grams += totalGrams;
        } else {
          deductions.set(r.itemId, { ref: docRef("items", r.itemId), grams: totalGrams, name: r.itemName });
        }
      }
    }

    // Read all affected stock items
    const stockEntries = Array.from(deductions.entries());
    const stockSnaps = await Promise.all(stockEntries.map(([, v]) => tx.get(v.ref)));

    // Validate stock availability
    for (let i = 0; i < stockEntries.length; i++) {
      const [, entry] = stockEntries[i];
      const snap = stockSnaps[i];
      if (!snap.exists()) continue;
      const available = (snap.data().stockShop as number) || 0;
      if (available < entry.grams) {
        throw new Error(
          `المخزون غير كافٍ للصنف "${entry.name}" — المتوفر: ${available}ج، المطلوب: ${entry.grams}ج`
        );
      }
    }

    // Deduct stock
    for (let i = 0; i < stockEntries.length; i++) {
      const snap = stockSnaps[i];
      if (!snap.exists()) continue;
      tx.update(snap.ref, { stockShop: increment(-stockEntries[i][1].grams), updatedAt: Timestamp.now() });
    }

    // Create the order document
    tx.set(orderRef, {
      ...data,
      orderNumber,
      date: today,
      createdAt: Timestamp.now(),
    });
  });

  return { id: orderRef.id, orderNumber };
}

export async function getOrders(date?: string) {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  if (date) constraints.unshift(where("date", "==", date));
  const snap = await getDocs(query(col("orders"), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Unused export kept for tree-shaking — onSnapshot used on client directly
export { onSnapshot };
