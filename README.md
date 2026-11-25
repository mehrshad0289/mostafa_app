# Mostafa App

وب‌اپلیکیشن Next.js؛ یادداشت‌ها، فم بانک و دو لایه ادمین/عضو؛ داده در Supabase PostgreSQL (محلی بدون متغیرها: فایل).

- سایت: https://mostafaapp.vercel.app
- گیت‌هاب: https://github.com/mehrshad0289/mostafa_app

## بخش‌ها

- **یادداشت‌ها**: صفحه اصلی + پنل «Mostafa App حقیقی» (`/haqiqi`) با فیلد `kind`
  (`general` / `haqiqi`) و فیلتر سمت API.
- **فم بانک** (مسیر `/bank`): پورت کامل اپ نمونه کاربر به
  Next.js با همان منطق و فرمول‌ها.
- **دو لایه (ادمین + عضو)**: ورود (`/login`) با نشست کوکی امضاشده (HMAC)؛ ادمین →
  `/admin` (نمای کلی، مدیریت کاربران، درخواست‌های اعضا) و `/bank`؛ عضو →
  `/dashboard` (پرداخت سهام/قسط با رسید، درخواست تسهیلات، پروفایل). فیلتر داده
  سمت سرور؛ ادمین پیش‌فرض: admin / Admin@12345 (بعد از اولین ورود عوض شود).

## فم بانک

- تب‌ها: اعضا، واریزی‌ها، وام‌ها و اقساط، گزارش‌ها، تنظیمات، سوابق.
- فیچر محوری: **اعتبار عضو = جمع واریزی‌های سهام**؛ تعهد ماهانه با carry بین
  ماه‌ها، بدهی و مانده خالص هر عضو، پرونده مالی عضو و تسویه نهایی با اعداد
  قابل ویرایش.
- وام با جدول اقساط خودکار/دستی، ثبت و حذف پرداخت و تغییر وضعیت خودکار
  (جاری / تسویه‌شده).
- تقویم شمسی بومی با `Intl` (بدون کتابخانه جدید) و پشتیبانی ارقام فارسی و
  جداکننده هزارگان در همه ورودی‌های مبلغ.
- گزارش‌ها: گزارش مالی عضو، گردش ماهانه بانک، خلاصه سالانه.
- خروجی CSV (UTF-8+BOM) و چاپ گزارش؛ پشتیبان‌گیری و بازیابی JSON با
  اعتبارسنجی کامل؛ قفل مدیر با PIN (هش SHA-256 در localStorage).

## معماری

- داده: Supabase PostgreSQL — ۹ جدول (items، users، bank_settings، bank_members،
  bank_deposits، bank_loans، bank_audit، payment_requests، loan_requests)؛
  schema در `supabase/migrations/20261125000000_init.sql`. اتصال فقط با دو
  متغیر `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` از طریق
  `lib/supabase.ts`؛ همه خواندن/نوشتن از `lib/db.ts` (`readDb`/`writeDb`).
  در نبود متغیرها (اجرای محلی بدون دیتابیس) fallback فایل `data/db.json` است.
- منطق خالص بدون I/O: `lib/bank.ts` (تقویم شمسی، فرمول‌های عضو/وام/بانک).
- API: `app/api/items/...` و `app/api/bank/...` (members، deposits، loans،
  settings، audit، backup).
- UI: RTL فارسی با Tailwind؛ کامپوننت‌های بانک در `app/components/bank/`.
- دیپلوی: Vercel، auto-deploy از `main`. ماندگاری داده با تنظیم دو متغیر
  Supabase در Environment Variables پروژه Vercel کامل می‌شود؛ تا تنظیم آن‌ها
  داده در فایل موقت سرور می‌رود و با سرد شدن سرور از بین می‌رود.
## اجرا

```bash
npm install
npm run dev
```

## مستندات (برای هوش مصنوعی بعدی)

- `docs/HANDOFF.md` — وضعیت کار و تاریخچه جلسه‌ها (اول این را بخوان).
- `docs/AGENT_PROMPT.md` — پرامپت پایه هر جلسه.
- `docs/STEPS.md` — نقشه ۲۰ استپی پروژه فم بانک (همه استپ‌ها انجام شده).
- `docs/BANK_SPEC.md` — مشخصات محصول و فرمول‌های فم بانک.
