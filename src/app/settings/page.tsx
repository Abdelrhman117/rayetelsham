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
} from "@/lib/firestore";
import { Employee } from "@/types";
import { toast } from "sonner";
import { auth, db, storage } from "@/lib/firebase";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { setDoc, getDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export default function SettingsPage() {
  const [tab, setTab] = useState<"employees" | "logo" | "account">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [stats, setStats] = useState({ suppliers: 0, employees: 0 });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [empForm, setEmpForm] = useState({ name: "", role: "طباخ", dailyWage: 0 });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });

  useEffect(() => {
    loadData();
    getDoc(doc(db, "appSettings", "branding")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setLogoDataUrl(d.logoUrl || d.logoDataUrl || null);
      }
    });
  }, []);

  async function loadData() {
    const [emps, sups] = await Promise.all([
      getEmployees(),
      getSuppliers(),
    ]);
    setEmployees(emps as Employee[]);
    setStats({
      employees: emps.length,
      suppliers: sups.length,
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
    try {
      await deleteEmployee(id);
      toast.success("تم الحذف");
      loadData();
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    }
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2MB");
      return;
    }
    setLoading(true);
    try {
      const logoRef = ref(storage, "branding/logo");
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      await setDoc(doc(db, "appSettings", "branding"), { logoUrl: url, logoDataUrl: "" });
      setLogoDataUrl(url);
      toast.success("تم رفع الشعار");
    } catch {
      toast.error("فشل رفع الشعار — تحقق من إعدادات Firebase Storage");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteLogo() {
    setLoading(true);
    try {
      try {
        await deleteObject(ref(storage, "branding/logo"));
      } catch { /* لا يهم إذا لم يكن موجوداً في Storage */ }
      await setDoc(doc(db, "appSettings", "branding"), { logoUrl: "", logoDataUrl: "" });
      setLogoDataUrl(null);
      toast.success("تم حذف الشعار");
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    } finally {
      setLoading(false);
    }
  }

  const ROLES = ["طباخ", "كاشير", "نادل", "مساعد مطبخ", "مدير", "سائق", "أمن", "نظافة", "أخرى"];

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">الإعدادات</h1>

        {/* Stats overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.employees}</p>
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">موظف</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.suppliers}</p>
            <p className="text-sm text-orange-600 dark:text-orange-500 mt-1">مورد</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {[
            { key: "employees", label: "الموظفون" },
            { key: "logo", label: "اللوجو" },
            { key: "account", label: "الحساب" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-yellow-500 text-yellow-600 dark:text-yellow-400 dark:border-yellow-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
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
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">الاسم</th>
                    <th className="pb-2 font-medium">الدور</th>
                    <th className="pb-2 font-medium">الأجر اليومي</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900">
                      <td className="py-2 font-medium">{emp.name}</td>
                      <td className="py-2">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-2 text-amber-700 font-medium">
                        {new Intl.NumberFormat("ar-EG").format(emp.dailyWage)} ج.م
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
                      <td colSpan={4} className="text-center text-gray-400 dark:text-slate-600 py-6">
                        لا يوجد موظفون. أضف أول موظف.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "logo" && (
          <Card title="شعار التطبيق">
            <div className="space-y-6 max-w-sm">
              {logoDataUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={logoDataUrl}
                    className="w-32 h-32 object-contain rounded-2xl border border-gray-200 dark:border-slate-600"
                    alt="شعار التطبيق"
                  />
                  <Button variant="danger" size="sm" onClick={handleDeleteLogo}>
                    حذف الشعار
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
                  <svg className="w-12 h-12 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  رفع شعار جديد
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="block w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 dark:file:bg-yellow-950/30 dark:file:text-yellow-400"
                />
                <p className="text-xs text-gray-400 dark:text-slate-500">يُفضل صورة مربعة بخلفية شفافة (PNG) — الحد الأقصى 2MB</p>
              </div>
            </div>
          </Card>
        )}

        {tab === "account" && (
          <Card title="إعدادات الحساب">
            <div className="max-w-sm space-y-5">
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">البريد الإلكتروني</p>
                <p className="text-gray-700 dark:text-slate-300 mt-1">{auth.currentUser?.email}</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800 dark:text-slate-200">تغيير كلمة المرور</h3>
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

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                <h3 className="font-medium text-gray-800 dark:text-slate-200 mb-3">معلومات التطبيق</h3>
                <div className="text-sm text-gray-500 dark:text-slate-500 space-y-1">
                  <p>راية الشام — نظام إدارة المطعم</p>
                  <p>الإصدار: 1.0.0</p>
                  <p>المنصة: Next.js + Firebase</p>
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
            label="الأجر اليومي (ج.م)"
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
