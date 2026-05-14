# 🥙 رايا الشام — نظام إدارة المطعم

نظام إدارة متكامل لمطعم الشاورما السوري "رايا الشام" مبني بـ Next.js 14 و Firebase.

## الميزات الرئيسية

| الميزة | الوصف |
|--------|--------|
| 📦 إدارة المخزون | مخزنان (رئيسي + محل)، نقل بضاعة، جرد شهري، تنبيهات نقص |
| 🛒 المشتريات والموردون | فواتير شراء، كشف حساب مورد، تسجيل مدفوعات |
| 💼 المبيعات والعملاء | فواتير بيع آجل، كشف حساب عميل، تحصيل مدفوعات |
| 🏪 مبيعات يومية | تسجيل مبيعات المحل (نقد/بطاقة/محفظة) |
| 💸 المصروفات | تسجيل وتصنيف جميع المصاريف مع تقارير |
| 👷 الرواتب | كشف حضور يومي، رواتب موظفين، تقرير شهري |
| 📈 التقارير | قائمة أرباح وخسائر شهرية (COGS + صافي ربح) |
| 🧾 الفواتير | توليد فاتورة HTML قابلة للطباعة في Firebase Storage |
| ⚙️ الإعدادات | إدارة الموظفين، تغيير كلمة المرور |

## متطلبات التشغيل

- Node.js 18+
- حساب Firebase

## خطوات الإعداد

### 1. تثبيت الحزم

```bash
npm install
```

### 2. إعداد Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. فعّل **Authentication → Email/Password**
3. فعّل **Firestore Database** (وضع الاختبار)
4. فعّل **Storage**

### 3. متغيرات البيئة

```bash
cp .env.example .env.local
```

ثم املأ القيم من Firebase Console → Project Settings.

### 4. إنشاء المستخدم الأول

في Firebase Console → Authentication → Users → Add user:
- مثال: `admin@rayaalsham.com`

### 5. قواعد Firestore

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. تشغيل التطبيق

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000)

## النشر على Vercel

1. ادفع الكود إلى GitHub
2. اربط المستودع بـ Vercel
3. أضف متغيرات البيئة في Vercel → Settings → Environment Variables
4. انشر!

## بنية المشروع

```
src/
├── app/
│   ├── login/          # تسجيل الدخول
│   ├── dashboard/      # لوحة التحكم
│   ├── inventory/      # المخزون
│   ├── purchases/      # المشتريات
│   ├── sales/          # المبيعات
│   ├── daily-sales/    # المبيعات اليومية
│   ├── expenses/       # المصروفات
│   ├── salaries/       # الرواتب
│   ├── reports/        # التقارير
│   ├── invoices/       # الفواتير
│   ├── settings/       # الإعدادات
│   └── api/generate-pdf/
├── components/layout, ui, forms
├── hooks/useAuth.ts
├── lib/firebase.ts, firestore.ts, utils.ts
└── types/index.ts
```

## التقنيات

- Next.js 14 App Router + TypeScript
- Tailwind CSS (RTL Arabic)
- Firebase (Auth, Firestore, Storage)
- Recharts + Sonner + date-fns
