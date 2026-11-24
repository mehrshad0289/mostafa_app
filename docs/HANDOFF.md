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
- **کار فعال فعلی ریپو: پورت «بانک حقیقی» (نمونه zip کاربر) به Mostafa App.**
  نقشه کامل اجرا با استپ‌های ردیابی‌شده در `docs/STEPS.md` است و مشخصات محصول در
  `docs/BANK_SPEC.md`. برای ادامه، اولین استپ با تیک `[ ]` در `docs/STEPS.md` را
  انجام بده (الگو: مدل داده → منطق → API → UI → گزارش/پشتیبان → تست نهایی).
- پنل «حقوقی» (الگوی `hoghoghi` مطابق یادداشت پایین) فعلاً معلق است؛ اولویت با
  نقشه استپ‌های بانک حقیقی است مگر کاربر چیز دیگری بگوید.
- تفسیر درخواست کاربر از «Mostafa App حقیقی»: پنل اشخاص حقیقی (طبق قرارداد رایج
  حقیقی/حقوقی). اگر منظور کاربر چیز دیگری بود، این بخش باید با هماهنگی او تغییر کند.

## آخرین به‌روزرسانی

- تاریخ: 2026-11-23
- کار: پنل «Mostafa App حقیقی» اضافه شد (فیلد `kind`، فیلتر API، صفحه `/haqiqi`،
  کامپوننت مشترک `NotesPanel`، ورودی از صفحه اصلی).

## جلسه 2026-11-24

- کار درخواستی این جلسه به کد این ریپو مربوط نبود: کاربر فایل
  `bank-haghighi-credit-equals-total-share-deposits.zip` را داد (اپ مستقل
  «بانک حقیقی»؛ وب PWA + سورس اندروید؛ خارج از این ریپو و Next.js نیست).
- قانون «اعتبار عضو = جمع واریزی‌های سهام» در هر دو نسخه `family-fund-web/index.html`
  و `family-fund-android/app/src/main/assets/index.html` اعمال شد:
  برچسب «اعتبار پیش‌پرداخت» به «اعتبار (جمع واریزی سهام)» تغییر کرد، فیلد
  `credit` به خروجی `memberShareDue` اضافه شد و ردیف «اعتبار (جمع واریزی سهام)»
  در کارت عضو و پرونده مالی نمایش داده می‌شود. منطق تسویه و تخصیص پرداخت‌ها
  دست نخورد. هر دو فایل همچنان بایت‌به‌بایت همگام‌اند.
- تست: `node --check` روی اسکریپت‌های inline و `sw.js`، و تست دودی در مرورگر
  headless (کارت عضو، پرونده مالی، بدون خطای کنسول).
- نتیجه به‌عنوان zip به‌روز شده با همان نام به کاربر تحویل شد؛ این ریپو فقط با
  همین یادداشت تغییر کرده است. گام پیشنهادی بعدی ریپو همچنان «پنل حقوقی» است.

## جلسه 2026-11-24 (دوم) — استپ‌بندی پروژه «بانک حقیقی»

- کاربر همان zip بانک حقیقی را این‌بار «به‌عنوان نمونه و ایده» داد و خواست: کار
  به استپ‌های سبک تقسیم شود، استپ‌ها کامل درون ریپو نوشته شوند، و هر AI بعدی فقط
  با جمله «استپ بعد را انجام بده» بتواند ادامه دهد (بدون وابستگی به گفت‌وگوهای
  قبلی یا فایل‌های محلی).
- تحلیل نمونه انجام شد: اپ مستقل «بانک حقیقی / صندوق خانوادگی» با اعضا، واریزی
  سهام، وام و اقساط، تسویه نهایی، گزارش، CSV/چاپ، پشتیبان JSON و تقویم شمسی؛
  فیچر محوری «اعتبار عضو = جمع واریزی‌های سهام».
- ساخته شد:
  - `docs/BANK_SPEC.md` — مشخصات کامل نمونه (امکانات، مدل داده، فرمول‌ها، رفتارهای UI).
  - `docs/STEPS.md` — نقشه ۲۰ استپی با چک‌باکس + راهنمای الزامی ادامه برای AI بعدی.
- **استپ ۱ (مستندسازی و استپ‌بندی) انجام و پوش شد. ۱۹ استپ باقی مانده است.**
- قدم بعدی مشخص: **استپ ۲ — مدل داده بانک در JSON** (`lib/db.ts` + `data/db.json`؛
  شرح کامل در `docs/STEPS.md`).
- تصمیم پیش‌فرض (قابل تغییر با حرف کاربر): بخش جدید با نام «بانک حقیقی» در مسیر
  `/bank` ساخته می‌شود و به `/haqiqi` و صفحه اصلی لینک می‌خورد؛ تقویم شمسی با
  `Intl` بومی و بدون کتابخانه جدید.

### پیشرفت همین جلسه — استپ ۲ انجام شد

- **استپ ۲ (مدل داده بانک در JSON) کامل و پوش شد. ۱۸ استپ از ۲۰ باقی مانده است.**
  - `lib/db.ts`: تایپ‌های بانک (`BankSettings`، `BankMember`، `BankDeposit`،
    `BankLoanInstallment`، `BankLoanPayment`، `BankLoan`، `BankAudit`،
    `BankDatabase`) + `DEFAULT_BANK` + `normalizeBank`؛ کلید `bank` در تایپ
    `Database`؛ `readDb` در نبود کلید `bank` آن را backfill می‌کند و مسیر نوشتن
    هم `bank` را حفظ می‌کند (با تست تأیید شد).
  - `data/db.json`: مقدار اولیه `bank` (amountPerShare=500000، ۴ عنوان پیش‌فرض
    واریزی، آرایه‌های خالی).
  - تست: `npm run lint` و `npm run build` بدون خطا؛ سرور production با
    `next start` — `GET /api/items`، `POST /api/items` و `GET /api/items?kind=haqiqi`
    سالم؛ پس از نوشتن، کلید `bank` در `data/db.json` حفظ شد.
- قدم بعدی مشخص: **استپ ۳ — منطق محاسباتی خالص در `lib/bank.ts`** (شرح کامل در
  `docs/STEPS.md`؛ فرمول‌ها در `docs/BANK_SPEC.md` بخش ۳).

### پیشرفت همین جلسه — استپ ۳ انجام شد

- **استپ ۳ (منطق محاسباتی خالص در `lib/bank.ts`) کامل و پوش شد. ۱۷ استپ از ۲۰ باقی مانده است.**
  - `lib/bank.ts` ساخته شد — فقط توابع خالص، بدون I/O و بدون کتابخانه خارجی:
    - تقویم شمسی: `jalaliParts`، `monthKey`، `jalaliMonthSerial`، `jalaliToDate`
      (تبدیل شمسی→میلادی با تخمین نوروز + اصلاح دقیق با Intl)، `parseSharePeriod`
      (اعداد فارسی/عربی و نام ماه‌ها)، `normalizeDigits`، `depositPeriod`.
    - وام: `loanPaid`، `loanRemaining`، `loanTotals`، `makeSchedule` (خودکار/
      دستی با اعتبارسنجی جمع)، `bankUid`.
    - عضو: `memberClaim` (اعتبار = جمع واریزی سهام)، `memberShareDue` (تعهد ماهانه،
      carry، مانده، اعتبار، عقب‌افتادگی)، `memberDebt`.
    - صندوق: `recalcFund` (موجودی = واریزی‌ها + بازپرداخت‌ها − پرداختی وام؛ سود کل)،
      `monthlyTotals` (گردش ماهانه با کلید شمسی؛ متفرقه در ستون profit مطابق نمونه).
  - تست عددی: `scripts/test_bank_step3.mjs` (خارج از ریپو) — **۵۵ شرط، همه پاس**
    (round-trip شمسی شامل سال کبیسه ۱۴۰۳، اعضا و carry، اقساط خودکار/دستی،
    موجودی صندوق، گردش ماهانه).
  - `npm run lint` و `npm run build` بدون خطا.
- قدم بعدی مشخص: **استپ ۴ — API اعضا** (`app/api/bank/members/...`؛ شرح کامل در
  `docs/STEPS.md`).

### پیشرفت همین جلسه — استپ ۴ انجام شد

- **استپ ۴ (API اعضا) کامل و پوش شد. ۱۶ استپ از ۲۰ باقی مانده است.**
  - `lib/db.ts`: `getBank` + عملیات اعضا (`createBankMember`، `updateBankMember`،
    `deleteBankMember`) + helper `addAudit` (سوابق جدیدترین اول، سقف ۱۰۰۰ رکورد).
  - روت‌ها: `app/api/bank/members/route.ts` (GET لیست، POST افزودن) و
    `app/api/bank/members/[id]/route.ts` (PATCH، DELETE) — همان الگوی روت‌های
    items (پارامتر داینامیک Promise، خطا 400/404).
  - اعتبارسنجی: نام غیرخالی، shares عدد > 0، gender فقط male/female؛ پیام خطاها
    فارسی (متفاوت از پیام‌های انگلیسی items — عمدی است).
  - تست: lint و build پاس؛ **۱۵ شرط curl** روی سرور production (پورت 3100) همه
    پاس؛ اسکریپت `scripts/test_step4_api.sh` خارج از ریپو. auditLog صحیح ثبت شد
    و پس از نوشتن، `items` و `settings` و کلید `bank` دست‌نخورده ماندند.
- قدم بعدی مشخص: **استپ ۵ — API واریزی‌ها** (`app/api/bank/deposits/...`؛ شرح کامل
  در `docs/STEPS.md`).

### پیشرفت همین جلسه — استپ ۵ انجام شد

- **استپ ۵ (API واریزی‌ها) کامل و پوش شد. ۱۵ استپ از ۲۰ باقی مانده است.**
  - `lib/db.ts`: `createBankDeposit`، `updateBankDeposit`، `deleteBankDeposit` +
    `BANK_DEPOSIT_TYPES`/`normalizeDepositType` + `recalcMemberTotals`
    (بازمحاسبه `totalDeposited` عضو با هر ذخیره، مطابق spec) + عنوان پیش‌فرض
    واریزی از `settings.depositTitles` (به ترتیب نوع‌ها).
  - روت‌ها: `app/api/bank/deposits/route.ts` (GET با فیلترهای اختیاری
    `?memberId=`/`?type=`، POST) و `app/api/bank/deposits/[id]/route.ts`
    (PATCH، DELETE).
  - قوانین: برای `share` عضو الزامی و `periodKey` با `parseSharePeriod` نرمال
    می‌شود؛ انواع دیگر `periodKey=""`؛ مبلغ > 0؛ عضو ناشناس = «واریزی متفرقه».
  - تست: lint و build پاس؛ **۲۲ شرط curl** روی سرور production همه پاس؛
    اسکریپت `scripts/test_step5_api.sh` خارج از ریپو. recalc پس از PATCH/DELETE،
    auditLog جدیدترین‌اول و رگرسیون items/settings تأیید شد.
- قدم بعدی مشخص: **استپ ۶ — API وام‌ها و اقساط** (`app/api/bank/loans/...` با
  `makeSchedule` و `loanTotals`؛ شرح کامل در `docs/STEPS.md`).

### پیشرفت همین جلسه — استپ ۶ انجام شد

- **استپ ۶ (API وام‌ها و اقساط) کامل و پوش شد. ۱۴ استپ از ۲۰ باقی مانده است.**
  - `lib/db.ts`: `createBankLoan`، `updateBankLoan`، `deleteBankLoan`،
    `addBankLoanPayment`، `deleteBankLoanPayment` + `BankLoanPatch`؛ فیلد
    `memberName` به `BankLoan` اضافه شد (طبق spec — خالص نبود در استپ ۲).
  - روت‌ها: `app/api/bank/loans/route.ts` (GET با فیلتر `?memberId=`/`?status=`،
    POST)، `app/api/bank/loans/[id]/route.ts` (PATCH، DELETE)، و
    `app/api/bank/loans/[id]/payments/route.ts` (POST ثبت پرداخت، DELETE با
    `?paymentId=`).
  - منطق: POST با `loanTotals` + `makeSchedule` (auto/manual)؛ خطاهای
    makeSchedule به 400 فارسی؛ PATCH مالی → بازمحاسبه جدول اقساط؛ مانده صفر →
    `status=paid`؛ حذف پرداخت → بازگشت به `active`؛ تاریخ پرداخت ISO یا شمسی.
  - تست: lint و build پاس؛ **۲۹ شرط curl** روی سرور production همه پاس؛
    اسکریپت `scripts/test_step6_api.sh` خارج از ریپو. (دو خطای TS وسط کار پیدا و
    رفع شد: `manualText` در `BankLoanPatch` و مقایسه نوعی در روت.)
- قدم بعدی مشخص: **استپ ۷ — API تسویه، تنظیمات و سوابق** (پایان مرحله ۱؛ شرح کامل
  در `docs/STEPS.md`).

### پیشرفت همین جلسه — استپ ۷ انجام شد (پایان مرحله ۱)

- **استپ ۷ (تسویه، تنظیمات، سوابق) کامل و پوش شد. ۱۳ استپ از ۲۰ باقی مانده است — مرحله ۱ (زیرساخت و API) کامل شد.**
  - `lib/db.ts`: `settleBankMember` (net = claim − debt؛ ثبت دوباره = ویرایش با
    audit «ویرایش»)، `unsettleBankMember` (لغو تسویه؛ بدون تسویه → 400) و
    `updateBankSettings` (PUT جزئی).
  - روت‌ها: `app/api/bank/members/[id]/settlement/route.ts` (POST/DELETE)،
    `app/api/bank/settings/route.ts` (GET/PUT)، `app/api/bank/audit/route.ts`
    (GET با `?limit=` پیش‌فرض ۱۰۰).
  - تصمیم عمدی: تغییر تنظیمات در auditLog ثبت نمی‌شود چون واژگان spec فقط
    عضو/واریزی/وام/پرداخت/تسویه را دارد. `depositTitles` در PUT نرمال می‌شود
    (trim + حذف رشته‌های خالی).
  - تست: lint و build پاس؛ **۲۴ شرط curl** روی سرور production همه پاس؛
    اسکریپت `scripts/test_step7_api.sh` خارج از ریپو. رگرسیون members/items هم
    سبز بود.
- قدم بعدی مشخص: **استپ ۸ — اسکلت صفحه `/bank`** (شروع مرحله ۲ — رابط کاربری؛
  شرح کامل در `docs/STEPS.md`).
