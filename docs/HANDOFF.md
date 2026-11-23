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
| `lib/db.ts` | خواندن و نوشتن JSON؛ مدل `Item` شامل فیلد `kind` است |
| `app/api/items/route.ts` | لیست (با فیلتر `?kind=`) و ایجاد |
| `app/api/items/[id]/route.ts` | ویرایش و حذف |
| `app/page.tsx` | صفحه اصلی (یادداشت‌های `general` + ورودی به پنل حقیقی) |
| `app/haqiqi/page.tsx` | پنل «Mostafa App حقیقی» (یادداشت‌های `haqiqi`) |
| `app/components/NotesPanel.tsx` | کامپوننت مشترک CRUD که هر دو صفحه استفاده می‌کنند |
| `docs/AGENT_PROMPT.md` | پرامپت پایه برای جلسه بعد |
| `docs/HANDOFF.md` | همین فایل؛ وضعیت کار |

## وضعیت الان

- پروژه ساخته شده، روی GitHub پوش شده، روی Vercel دیپلوی شده است.
- CRUD یادداشت روی نسخه زنده تست شده است.
- قوانین Cursor در `.cursor/rules/` اضافه شده است.
- بخش «Mostafa App حقیقی» اضافه شده است: صفحه `/haqiqi`، فیلد `kind` روی آیتم‌ها
  (`general` یا `haqiqi`)، فیلتر `GET /api/items?kind=haqiqi` و ارسال `kind` در
  `POST /api/items`. آیتم‌های قدیمی بدون `kind` در `readDb` به‌صورت خودکار
  `general` در نظر گرفته می‌شوند. لینت (`npm run lint`)، بیلد (`npm run build`)
  و API به‌صورت محلی با `next start` تست شد.

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

- بخش «Mostafa App حقیقی» تحویل داده شد و روی Vercel دیپلوی می‌شود (auto-deploy از `main`).
- اگر کاربر بخواهد، پنل «حقوقی» هم می‌تواند دقیقاً با همین الگو اضافه شود:
  مقدار `hoghoghi` را به `KINDS` در `lib/db.ts` اضافه کن، صفحه
  `app/hoghoghi/page.tsx` با `<NotesPanel kind="hoghoghi" />` بساز و ورودی آن را
  در صفحه اصلی بگذار.
- تفسیر درخواست کاربر از «Mostafa App حقیقی»: پنل اشخاص حقیقی (طبق قرارداد رایج
  حقیقی/حقوقی). اگر منظور کاربر چیز دیگری بود، این بخش باید با هماهنگی او تغییر کند.

## آخرین به‌روزرسانی

- تاریخ: 2026-11-23
- کار: پنل «Mostafa App حقیقی» اضافه شد (فیلد `kind`، فیلتر API، صفحه `/haqiqi`،
  کامپوننت مشترک `NotesPanel`، ورودی از صفحه اصلی).
