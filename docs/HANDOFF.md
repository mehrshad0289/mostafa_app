# HANDOFF

وضعیت فعلی پروژه برای هوش مصنوعی بعدی. این فایل را اول بخوان و آخر هر کار به‌روز کن.

## لینک‌ها

- GitHub: https://github.com/mehrshad0289/mostafa_app
- Remote: `https://github.com/mehrshad0289/mostafa_app.git`
- Branch: `main`
- Production: https://mostafaapp.vercel.app
- Vercel project: `mostafa_app` (connected to this GitHub repo)

## چیست

وب‌اپ Next.js برای یادداشت. دیتابیس فایل JSON است، نه سرویس خارجی.

## فایل‌های مهم

| مسیر | نقش |
| --- | --- |
| `data/db.json` | داده اولیه / دیتابیس محلی |
| `lib/db.ts` | خواندن و نوشتن JSON |
| `app/api/items/route.ts` | لیست و ایجاد |
| `app/api/items/[id]/route.ts` | ویرایش و حذف |
| `app/page.tsx` | رابط کاربری |
| `docs/AGENT_PROMPT.md` | پرامپت پایه برای جلسه بعد |
| `docs/HANDOFF.md` | همین فایل؛ وضعیت کار |

## وضعیت الان

- پروژه ساخته شده، روی GitHub پوش شده، روی Vercel دیپلوی شده است.
- CRUD یادداشت روی نسخه زنده تست شده است.
- قوانین Cursor در `.cursor/rules/` اضافه شده است.

## اجرای محلی

```bash
npm install
npm run dev
```

آدرس محلی: http://localhost:3000

## قوانین کار

1. اول `docs/HANDOFF.md` را بخوان.
2. تغییر کوچک و کامل بده؛ نیمه‌کاره رها نکن مگر اینکه در همین فایل بنویسی کجا ماندی.
3. بعد از اتمام: این فایل را به‌روز کن، commit بزن، به `origin/main` پوش کن.
4. توکن، رمز، و `.env` را commit نکن. ریپو پابلیک است.
5. کتابخانه جدید اضافه نکن مگر لازم باشد.

## کار بعدی

هنوز فیچر جدیدی در صف نیست. منتظر درخواست کاربر بمان.

## آخرین به‌روزرسانی

- تاریخ: 2026-11-23
- کار: پرامپت پایه، قوانین Cursor، و این فایل پیوستگی اضافه شد.
