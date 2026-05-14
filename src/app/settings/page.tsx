"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getSuppliers,
  getCustomers,
} from "@/lib/firestore";
import { Employee } from "@/types";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

export default function SettingsPage() {
  const [tab, setTab] = useState<"employees" | "account">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [stats, setStats] = useState({ suppliers: 0, customers: 0, employees: 0 });

  const [empForm, setEmpForm] = useState({ name: "", role: "طباخ", dailyWage: 0 });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [emps, sups, custs] = await Promise.all([
      getEmployees(),
      getSuppliers(),
      getCustomers(),
    ]);
    setEmployees(emps as Employee[]);
    setStats({
      employees: emps.length,
      suppliers: sups.length,
      customers: custs.length,
    });
  }

  function openAdd() {
    setEditEmp(null);
    setEmpForm({ name: "", role: "طباخ", dailyWage: 0 });
    setModal(true);
  }

  function openEdit(emp: Employee) {
    setEditEmp(emp);
    setEmpForm({ name: emp.name, role: emp.role, dailyWage: emp.dailyWage });
    setModal(true);
  }

  async function saveEmployee() {
    if (!empForm.name.trim()) { toast.error("يرجى إدخال اسم الموظف"); return; }
    if (empForm.dailyWage <= 0) { toast.error("يرجى إدخال أجر يومي صحيح"); return; }
    setLoading(true);
    try {
      if (editEmp) {
        await updateEmployee(editEmp.id, empForm);
        toast.success("تم تحديث بيانات الموظف");
      } else {
        await addEmployee(empForm);
        toast.success("تم إضافة الموظف");
      }
      setModal(false);
      loadData();
    } catch { toast.error("حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الموظف؟")) return;
    await deleteEmployee(id);
    toast.success("تم الحذف");
    loadData();
  }

  async function handleChangePassword() {
    if (!pwForm.current || !pwForm.newPw) { toast.error("يرجى ملء جميع الحقول"); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    if (pwForm.newPw.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Not authenticated");
      const cred = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwForm.newPw);
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch {
      toast.error("فشل تغيير كلمة المرور. تحقق من كلمة المرور الحالية.");
    } finally {
      setLoading(false);
    }
  }

  const ROLES = ["طباخ", "كاشير", "نادل", "مساعد مطبخ", "مدير", "سائق", "أمن", "نظافة", "أخرى"];

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>

        {/* Stats overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.employees}</p>
            <p className="text-sm text-amber-600 mt-1">موظف</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-700">{stats.suppliers}</p>
            <p className="text-sm text-orange-600 mt-1">مورد</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.customers}</p>
            <p className="text-sm text-blue-600 mt-1">عميل</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {[
            { key: "employees", label: "الموظفون" },
            { key: "account", label: "الحساب" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-amber-700 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "employees" && (
          <Card
            title={`الموظفون (${employees.length})`}
            actions={<Button size="sm" onClick={openAdd}>+ إضافة موظف</Button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-600">
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2 font-medium">الدور</th>
                    <th className="pb-2 font-medium">الأجر اليومي</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium">{emp.name}</td>
                      <td className="py-2">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-2 text-amber-700 font-medium">
                        {new Intl.NumberFormat("ar").format(emp.dailyWage)} ل.س
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(emp)} className="text-xs text-amber-700 hover:underline px-1">تعديل</button>
                          <button onClick={() => handleDeleteEmployee(emp.id)} className="text-xs text-red-600 hover:underline px-1">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!employees.length && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-6">
                        لا يوجد موظفون. أضف أول موظف.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "account" && (
          <Card title="إعدادات الحساب">
            <div className="max-w-sm space-y-5">
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800">البريد الإلكتروني</p>
                <p className="text-gray-700 mt-1">{auth.currentUser?.email}</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800">تغيير كلمة المرور</h3>
                <Input
                  label="كلمة المرور الحالية"
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                />
                <Input
                  label="كلمة المرور الجديدة"
                  type="password"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                />
                <Input
                  label="تأكيد كلمة المرور الجديدة"
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                />
                <Button onClick={handleChangePassword} loading={loading}>
                  تغيير كلمة المرور
                </Button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-800 mb-3">معلومات التطبيق</h3>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>🥙 رايا الشام — نظام إدارة المطعم</p>
                  <p>الإصدار: 1.0.0</p>
                  <p>المنصة: Next.js 14 + Firebase</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editEmp ? "تعديل موظف" : "إضافة موظف جديد"} size="sm">
        <div className="space-y-4">
          <Input
            label="الاسم الكامل"
            value={empForm.name}
            onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
          />
          <Select
            label="الدور / المسمى الوظيفي"
            value={empForm.role}
            onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input
            label="الأجر اليومي (ل.س)"
            type="number"
            min={0}
            value={empForm.dailyWage}
            onChange={(e) => setEmpForm({ ...empForm, dailyWage: Number(e.target.value) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>إلغاء</Button>
            <Button onClick={saveEmployee} loading={loading}>
              {editEmp ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
