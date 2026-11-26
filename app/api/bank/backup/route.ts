import { requireAdmin } from "@/lib/auth";
import { getBank, restoreBank } from "@/lib/db";
import { jalaliParts } from "@/lib/bank";
import type { BankDatabase } from "@/lib/db";

// ---------- پشتیبان‌گیری و بازیابی JSON (استپ ۱۸) ----------

const DEPOSIT_TYPES = new Set(["share", "loan_interest", "profit", "misc"]);
const GENDERS = new Set(["male", "female"]);
const INTEREST_MODES = new Set(["beginning", "end"]);
const LOAN_STATUSES = new Set(["active", "paid", "cancelled"]);

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

const isDate = (v: unknown): v is string =>
  isStr(v) && !Number.isNaN(new Date(v).getTime());

const numOrNull = (v: unknown) => v === null || isNum(v);
const strOrNull = (v: unknown) => v === null || isStr(v);

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/** پیام خطای فارسی برای رکورد شماره i از یک فهرست */
function rowError(listName: string, index: number, why: string) {
  return `فایل پشتیبان معتبر نیست: ردیف ${index + 1} از ${listName} — ${why}.`;
}

/** اعتبارسنجی کامل ساختار فایل پشتیبان پیش از جایگزینی — خطای اول با پیام فارسی */
function validateBackup(raw: unknown): { bank?: BankDatabase; error?: string } {
  if (!isObj(raw)) {
    return { error: "فایل پشتیبان معتبر نیست: محتوا باید یک شیء JSON باشد." };
  }
  const candidate = isObj(raw.bank) ? raw.bank : raw;

  // تنظیمات
  if (!isObj(candidate.settings)) {
    return { error: "فایل پشتیبان معتبر نیست: تنظیمات بانک یافت نشد." };
  }
  const s = candidate.settings;
  if (!isNum(s.amountPerShare) || s.amountPerShare <= 0) {
    return {
      error: "فایل پشتیبان معتبر نیست: «مبلغ هر سهم» باید عددی بزرگ‌تر از صفر باشد.",
    };
  }
  if (!isArr(s.depositTitles) || !s.depositTitles.every(isStr)) {
    return {
      error: "فایل پشتیبان معتبر نیست: «عنوان‌های آماده واریزی» باید آرایه‌ای از متن باشد.",
    };
  }
  if (typeof s.duplicateWarning !== "boolean") {
    return {
      error: "فایل پشتیبان معتبر نیست: مقدار «هشدار تراکنش مشابه» باید بولی باشد.",
    };
  }

  // فهرست‌های اصلی
  if (!isArr(candidate.members)) {
    return { error: "فایل پشتیبان معتبر نیست: فهرست «اعضا» باید آرایه باشد." };
  }
  if (!isArr(candidate.deposits)) {
    return { error: "فایل پشتیبان معتبر نیست: فهرست «واریزی‌ها» باید آرایه باشد." };
  }
  if (!isArr(candidate.loans)) {
    return { error: "فایل پشتیبان معتبر نیست: فهرست «وام‌ها» باید آرایه باشد." };
  }

  // اعضا
  const memberIds = new Set<string>();
  const members = candidate.members;
  for (const [i, raw] of members.entries()) {
    if (!isObj(raw)) return { error: rowError("اعضا", i, "ساختار نامعتبر است") };
    if (!isStr(raw.id) || !raw.id.trim())
      return { error: rowError("اعضا", i, "شناسه (id) نامعتبر است") };
    if (memberIds.has(raw.id))
      return { error: rowError("اعضا", i, `شناسه «${raw.id}» تکراری است`) };
    if (!isStr(raw.name) || !raw.name.trim())
      return { error: rowError("اعضا", i, "نام الزامی است") };
    if (!isNum(raw.shares) || raw.shares < 0)
      return { error: rowError("اعضا", i, "تعداد سهم باید عددی نامنفی باشد") };
    if (!isStr(raw.phone) || !isStr(raw.note))
      return { error: rowError("اعضا", i, "تلفن و یادداشت باید متن باشند") };
    if (!isStr(raw.gender) || !GENDERS.has(raw.gender))
      return { error: rowError("اعضا", i, "جنسیت باید male یا female باشد") };
    if (!isNum(raw.totalDeposited))
      return { error: rowError("اعضا", i, "جمع واریزی ثبت‌شده باید عدد باشد") };
    if (typeof raw.settled !== "boolean")
      return { error: rowError("اعضا", i, "وضعیت تسویه باید بولی باشد") };
    if (!strOrNull(raw.settledAt) || !numOrNull(raw.settlementClaim) ||
      !numOrNull(raw.settlementDebt) || !numOrNull(raw.settlementNet))
      return { error: rowError("اعضا", i, "فیلدهای تسویه نامعتبر است") };
    if (!isDate(raw.createdAt))
      return { error: rowError("اعضا", i, "تاریخ عضویت نامعتبر است") };
    memberIds.add(raw.id);
  }

  // واریزی‌ها
  for (const [i, raw] of candidate.deposits.entries()) {
    if (!isObj(raw)) return { error: rowError("واریزی‌ها", i, "ساختار نامعتبر است") };
    if (!isStr(raw.id) || !raw.id.trim())
      return { error: rowError("واریزی‌ها", i, "شناسه (id) نامعتبر است") };
    if (raw.memberId !== null &&
      (!isStr(raw.memberId) || (raw.memberId !== "" && !memberIds.has(raw.memberId))))
      return { error: rowError("واریزی‌ها", i, "به عضوی اشاره می‌کند که در فهرست اعضا نیست") };
    if (!isStr(raw.memberName) || !isStr(raw.title))
      return { error: rowError("واریزی‌ها", i, "نام عضو و عنوان باید متن باشند") };
    if (!isStr(raw.type) || !DEPOSIT_TYPES.has(raw.type))
      return { error: rowError("واریزی‌ها", i, "نوع واریزی نامعتبر است") };
    if (!isNum(raw.amount) || raw.amount < 0)
      return { error: rowError("واریزی‌ها", i, "مبلغ باید عددی نامنفی باشد") };
    if (!isStr(raw.periodKey))
      return { error: rowError("واریزی‌ها", i, "دوره باید متن باشد") };
    if (!isDate(raw.createdAt))
      return { error: rowError("واریزی‌ها", i, "تاریخ ثبت نامعتبر است") };
  }

  // وام‌ها
  for (const [i, raw] of candidate.loans.entries()) {
    if (!isObj(raw)) return { error: rowError("وام‌ها", i, "ساختار نامعتبر است") };
    if (!isStr(raw.id) || !raw.id.trim())
      return { error: rowError("وام‌ها", i, "شناسه (id) نامعتبر است") };
    if (!isStr(raw.memberId) || !memberIds.has(raw.memberId))
      return { error: rowError("وام‌ها", i, "به عضوی اشاره می‌کند که در فهرست اعضا نیست") };
    if (!isStr(raw.memberName) || !isStr(raw.note))
      return { error: rowError("وام‌ها", i, "نام عضو و یادداشت باید متن باشند") };
    for (const field of ["principal", "interestAmount", "totalAmount", "disbursedAmount"] as const) {
      if (!isNum(raw[field]) || raw[field] < 0)
        return { error: rowError("وام‌ها", i, `فیلد «${field}» باید عددی نامنفی باشد`) };
    }
    if (!isStr(raw.interestMode) || !INTEREST_MODES.has(raw.interestMode))
      return { error: rowError("وام‌ها", i, "حالت سود باید beginning یا end باشد") };
    if (!isNum(raw.installmentCount) || !Number.isInteger(raw.installmentCount) || raw.installmentCount < 0)
      return { error: rowError("وام‌ها", i, "تعداد اقساط باید عدد صحیح نامنفی باشد") };
    if (!isStr(raw.status) || !LOAN_STATUSES.has(raw.status))
      return { error: rowError("وام‌ها", i, "وضعیت وام نامعتبر است") };
    if (!isDate(raw.createdAt))
      return { error: rowError("وام‌ها", i, "تاریخ ثبت نامعتبر است") };
    if (!isArr(raw.schedule))
      return { error: rowError("وام‌ها", i, "جدول اقساط باید آرایه باشد") };
    for (const [j, inst] of raw.schedule.entries()) {
      if (!isObj(inst) || !isStr(inst.id) || !isNum(inst.number) ||
        !isNum(inst.amount) || inst.amount < 0 || !isStr(inst.dueAt))
        return { error: rowError("وام‌ها", i, `قسط شماره ${j + 1} نامعتبر است`) };
    }
    if (!isArr(raw.payments))
      return { error: rowError("وام‌ها", i, "فهرست پرداخت‌ها باید آرایه باشد") };
    for (const [j, pay] of raw.payments.entries()) {
      if (!isObj(pay) || !isStr(pay.id) || !isNum(pay.amount) ||
        pay.amount < 0 || !isDate(pay.paidAt) || !isStr(pay.note))
        return { error: rowError("وام‌ها", i, `پرداخت شماره ${j + 1} نامعتبر است`) };
    }
  }

  // سوابق — فیلد اختیاری برای سازگاری فایل‌های دستی
  const auditLog: unknown[] = isArr(candidate.auditLog) ? candidate.auditLog : [];
  for (const [i, raw] of auditLog.entries()) {
    if (!isObj(raw) || !isStr(raw.id) || !isDate(raw.at) || !isStr(raw.action) ||
      !isStr(raw.kind) || !isStr(raw.recordId) || !isStr(raw.detail))
      return { error: rowError("سوابق", i, "ساختار نامعتبر است") };
  }

  return {
    bank: {
      settings: {
        amountPerShare: s.amountPerShare,
        depositTitles: s.depositTitles as string[],
        duplicateWarning: s.duplicateWarning,
        // حساب‌های واریز در پشتیبان‌های قدیمی نیست؛ normalizeBank مقدار خالی می‌گذارد
        depositAccounts:
          (s.depositAccounts ?? {
            primary: { holder: "", cardNumber: "", sheba: "" },
            alternate: { holder: "", cardNumber: "", sheba: "" },
          }) as BankDatabase["settings"]["depositAccounts"],
        // حساب‌های واریز تسهیلات اعضا در پشتیبان‌های قدیمی نیست؛ خالی گذاشته می‌شود (جلسه ۳۶)
        loanPayoutAccounts:
          (s.loanPayoutAccounts ?? {}) as BankDatabase["settings"]["loanPayoutAccounts"],
        // نشانگر زنگوله اعضا در پشتیبان‌های قدیمی نیست؛ خالی گذاشته می‌شود (جلسه ۳۷)
        memberNotifCursors:
          (s.memberNotifCursors ?? {}) as BankDatabase["settings"]["memberNotifCursors"],
        // پیام‌رسان در پشتیبان‌های قدیمی نیست؛ خالی گذاشته می‌شود (جلسه ۴۹)
        messages:
          (s.messages ?? { fromAdmin: [], fromMembers: [] }) as BankDatabase["settings"]["messages"],
      },
      members: candidate.members as BankDatabase["members"],
      deposits: candidate.deposits as BankDatabase["deposits"],
      loans: candidate.loans as BankDatabase["loans"],
      auditLog: auditLog as BankDatabase["auditLog"],
    },
  };
}

/** GET — دانلود کل داده بانک با نام فایل تاریخ‌دار شمسی (فقط ادمین) */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const bank = await getBank();
  const { year, month, day } = jalaliParts(new Date());
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${year}-${p(month)}-${p(day)}`;
  return new Response(JSON.stringify(bank, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bank-backup-${stamp}.json"; filename*=UTF-8''${encodeURIComponent(`پشتیبان-بانک-${stamp}.json`)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** POST — بازیابی با اعتبارسنجی کامل ساختار پیش از جایگزینی (فقط ادمین) */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return bad("فایل پشتیبان معتبر نیست: محتوا JSON معتبر نیست.");
  }
  const result = validateBackup(raw);
  if (result.error || !result.bank) {
    return bad(result.error ?? "فایل پشتیبان معتبر نیست.");
  }
  const bank = await restoreBank(result.bank);
  return Response.json({
    ok: true,
    counts: {
      members: bank.members.length,
      deposits: bank.deposits.length,
      loans: bank.loans.length,
    },
  });
}
