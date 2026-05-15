import { Timestamp } from "firebase/firestore";

export interface Item {
  id: string;
  name: string;
  unit: string;
  stockMain: number;
  stockShop: number;
  lowStockThreshold: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Transfer {
  id: string;
  date: Timestamp;
  fromWarehouse: "main" | "shop";
  toWarehouse: "main" | "shop";
  items: { itemId: string; itemName: string; quantity: number }[];
  note: string;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address: string;
  createdAt: Timestamp;
}

export interface InvoiceItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  date: Timestamp;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  dueDate: Timestamp;
  status: "paid" | "unpaid" | "partial";
  receivingWarehouse: "main" | "shop";
  pdfUrl: string;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceIds: string[];
  amount: number;
  date: Timestamp;
  note: string;
  createdAt: Timestamp;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  createdAt: Timestamp;
}

export interface SalesInvoice {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  date: Timestamp;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  dueDate: Timestamp;
  status: "paid" | "unpaid" | "partial";
  pdfUrl: string;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  invoiceIds: string[];
  amount: number;
  date: Timestamp;
  note: string;
  createdAt: Timestamp;
}

export interface DailySale {
  id: string;
  date: string;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  totalSales: number;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ExpenseCategory =
  | "إيجار"
  | "كهرباء"
  | "ماء"
  | "غاز"
  | "إنترنت"
  | "صيانة"
  | "مستلزمات نظافة"
  | "مواصلات"
  | "رسوم حكومية"
  | "تسويق"
  | "أخرى";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: "نقد" | "بطاقة" | "محفظة";
  note: string;
  createdAt: Timestamp;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  dailyWage: number;
  createdAt: Timestamp;
}

export interface SalaryRecord {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  dailyWage: number;
  paid: boolean;
  createdAt: Timestamp;
}

export interface Deduction {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  reason: string;
  note: string;
  createdAt: Timestamp;
}

export interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  repaidAmount: number;
  status: "active" | "partial" | "repaid";
  reason: string;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdvancePayment {
  id: string;
  advanceId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  note: string;
  createdAt: Timestamp;
}

export interface InventoryCount {
  id: string;
  date: string;
  month: string;
  items: {
    itemId: string;
    itemName: string;
    unit: string;
    bookMain: number;
    bookShop: number;
    actualMain: number;
    actualShop: number;
  }[];
  note: string;
  createdAt: Timestamp;
}

export interface SupplierReturnItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SupplierReturn {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  returnType: "goods" | "credit";
  items: SupplierReturnItem[];
  creditAmount: number;
  totalAmount: number;
  warehouse: "main" | "shop";
  note: string;
  createdAt: Timestamp;
}
