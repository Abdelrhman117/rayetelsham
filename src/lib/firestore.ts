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
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

// Generic collection helper
export const col = (name: string) => collection(db, name);
export const docRef = (colName: string, id: string) => doc(db, colName, id);

// Generate invoice number
export async function generateInvoiceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${year}${month}-${rand}`;
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
  const batch = writeBatch(db);

  for (const item of transfer.items) {
    const itemDocRef = docRef("items", item.itemId);
    const fromField = transfer.fromWarehouse === "main" ? "stockMain" : "stockShop";
    const toField = transfer.toWarehouse === "main" ? "stockMain" : "stockShop";
    batch.update(itemDocRef, {
      [fromField]: increment(-item.quantity),
      [toField]: increment(item.quantity),
      updatedAt: Timestamp.now(),
    });
  }

  const transferRef = doc(col("transfers"));
  batch.set(transferRef, {
    ...transfer,
    date: Timestamp.now(),
    createdAt: Timestamp.now(),
  });

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

  // Auto-add stock to warehouse
  const items = data.items as { name: string; quantity: number }[];
  const warehouse = data.receivingWarehouse as "main" | "shop";
  // Items are added by name; if they exist in inventory update stock
  const itemsSnap = await getDocs(col("items"));
  const batch = writeBatch(db);
  for (const invoiceItem of items) {
    const existing = itemsSnap.docs.find(
      (d) => d.data().name.toLowerCase() === invoiceItem.name.toLowerCase()
    );
    if (existing) {
      const field = warehouse === "main" ? "stockMain" : "stockShop";
      batch.update(existing.ref, { [field]: increment(invoiceItem.quantity), updatedAt: Timestamp.now() });
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
  const batch = writeBatch(db);
  const payRef = doc(col("supplierPayments"));
  batch.set(payRef, { ...data, createdAt: Timestamp.now() });

  // Update invoices paidAmount
  let remaining = data.amount;
  for (const invId of data.invoiceIds) {
    if (remaining <= 0) break;
    const invRef = docRef("supplierInvoices", invId);
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
  data: Record<string, unknown>
) {
  const existing = await getDocs(
    query(col("salaries"), where("date", "==", date), where("employeeId", "==", employeeId))
  );
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
  const newRepaid = (adv.repaidAmount || 0) + paymentAmount;
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
