// منطق محاسباتی «بانک حقیقی» — فرمول‌ها مطابق docs/BANK_SPEC.md بخش ۳
// توابع خالص بدون I/O؛ تقویم شمسی با Intl بومی و بدون کتابخانه خارجی.

import type {
  BankDatabase,
  BankDeposit,
  BankLoan,
  BankLoanInstallment,
  BankMember,
} from "./db";

// ---------- ابزارهای تقویم شمسی ----------

const JALALI_PARTS_FORMATTER = new Intl.DateTimeFormat("en-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export type JalaliParts = { year: number; month: number; day: number };

export function normalizeDigits(value: string): string {
  return String(value)
    .replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c)));
}

/** نرمال‌سازی متن برای جست‌وجو: حروف فارسی/عربی یکسان، اعداد به لاتین، نیم‌فاصله به فاصله */
export function normalizeSearchText(value: string): string {
  return normalizeDigits(value)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** پارس مبلغ از ورودی آزاد: ارقام فارسی/عربی و جداکننده هزارگان (٬ ، , فاصله) پشتیبانی می‌شود */
export function parseAmount(value: string | number): number {
  return Number(
    normalizeDigits(String(value)).replace(/[\u066c\u060c,\s]/g, ""),
  );
}

export function jalaliParts(value: Date | string | number): JalaliParts {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { year: 0, month: 0, day: 0 };
  }
  const parts = JALALI_PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** کلید ماه شمسی به شکل «yyyy/mm» */
export function monthKey(value?: Date | string | number): string {
  const { year, month } = jalaliParts(value === undefined ? new Date() : value);
  return `${year}/${String(month).padStart(2, "0")}`;
}

/** سری ماه شمسی = سال×۱۲ + ماه − ۱ (برای فاصله گرفتن ماه‌ها) */
export function jalaliMonthSerial(key: string): number {
  const [year, month] = String(key || "").split("/").map(Number);
  return (year || 0) * 12 + (month || 1) - 1;
}

/** تبدیل عددی تاریخ شمسی به Date میلادی (ساعت ۱۲:۰۰ محلی) یا null اگر نامعتبر */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date | null {
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  // تخمین اولیه: نوروز حدود ۲۱ مارس سال +۶۲۱؛ سپس اصلاح دقیق با مقایسه اجزای شمسی
  const dayOfYear = (jm <= 6 ? 31 * (jm - 1) : 186 + 30 * (jm - 7)) + jd;
  const estimate = new Date(jy + 621, 2, 21, 12, 0, 0);
  estimate.setDate(estimate.getDate() + dayOfYear - 1);
  // فاز ۱ — پرش درشت ماه‌به‌ماه تا فاصله کمتر از یک ماه
  for (let i = 0; i < 8; i++) {
    const p = jalaliParts(estimate);
    const monthDiff = (p.year - jy) * 12 + (p.month - jm);
    if (monthDiff === 0) break;
    estimate.setDate(estimate.getDate() - monthDiff * 30);
  }
  // فاز ۲ — اصلاح ریز روزبه‌روز تا رسیدن دقیق (خطای تخمین حداکثر چند روز)
  for (let i = 0; i < 62; i++) {
    const p = jalaliParts(estimate);
    if (p.year === jy && p.month === jm && p.day === jd) return estimate;
    const monthDiff = (p.year - jy) * 12 + (p.month - jm);
    const dayDiff = monthDiff !== 0 ? Math.sign(monthDiff) : Math.sign(p.day - jd);
    estimate.setDate(estimate.getDate() - dayDiff);
  }
  return null;
}

/** تاریخ شمسی «yyyy/mm/dd» را به Date میلادی تبدیل می‌کند (پیش‌فرض ساعت ۱۲:۰۰) */
export function jalaliToDate(input: string, time = "12:00"): Date | null {
  const cleaned = normalizeDigits(String(input ?? "").trim());
  const match = cleaned.match(/(\d{3,4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  const timeMatch = normalizeDigits(String(time ?? "12:00")).match(/^(\d{1,2}):(\d{2})$/);
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;
  const gregorian = jalaliToGregorian(jy, jm, jd);
  if (!gregorian) return null;
  gregorian.setHours(hours, minutes, 0, 0);
  return gregorian;
}

/** تعداد روزهای ماه شمسی (فروردین..شهریور = ۳۱، مهر..بهمن = ۳۰، اسفند = ۲۹ یا ۳۰) */
export function jalaliMonthLength(jy: number, jm: number): number {
  const first = jalaliToGregorian(jy, jm, 1);
  if (!first) return 0;
  const ny = jm === 12 ? jy + 1 : jy;
  const nm = jm === 12 ? 1 : jm + 1;
  const next = jalaliToGregorian(ny, nm, 1);
  if (!next) return 0;
  return Math.round((next.getTime() - first.getTime()) / 86400000);
}

/** دوره ماه واریزی: periodKey اگر بود، وگرنه ماه شمسیِ تاریخ ثبت */
export function depositPeriod(deposit: BankDeposit): string {
  const key = String(deposit.periodKey || "").trim();
  return key || monthKey(deposit.createdAt);
}

/** ورودی آزاد دوره ماه را به کلید استاندارد «yyyy/mm» شمسی تبدیل می‌کند */
export function parseSharePeriod(value: unknown, fallbackDate?: Date | string | number): string {
  const raw = normalizeDigits(String(value ?? "").trim());
  const direct = raw.match(/(13\d{2}|14\d{2})\s*[\/.\-]\s*(\d{1,2})/);
  if (direct && Number(direct[2]) >= 1 && Number(direct[2]) <= 12) {
    return `${direct[1]}/${String(Number(direct[2])).padStart(2, "0")}`;
  }
  const nameIndex = JALALI_MONTH_NAMES.findIndex((name) => raw.includes(name));
  if (nameIndex >= 0) {
    const years = raw.match(/(?:13|14)?\d{2}/g);
    let year =
      years && years.length
        ? Number(years[years.length - 1])
        : jalaliParts(fallbackDate ?? new Date()).year;
    if (year < 100) year += 1400;
    if (year < 1300) year += 1400;
    return `${year}/${String(nameIndex + 1).padStart(2, "0")}`;
  }
  return monthKey(fallbackDate ?? new Date());
}

// ---------- وام ----------

export function loanPaid(loan: Pick<BankLoan, "payments">): number {
  return (loan.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

export function loanRemaining(loan: Pick<BankLoan, "totalAmount" | "payments">): number {
  return Math.max(0, Number(loan.totalAmount || 0) - loanPaid(loan));
}

/** کل بدهی و مبلغ واقعاً پرداختی وام بر اساس حالت سود (کسر از ابتدا / اضافه به انتها) */
export function loanTotals(
  principal: number,
  interest: number,
  interestMode: BankLoan["interestMode"],
): { totalAmount: number; disbursedAmount: number } {
  const totalAmount = interestMode === "end" ? principal + interest : principal;
  const disbursedAmount = interestMode === "beginning" ? Math.max(0, principal - interest) : principal;
  return { totalAmount, disbursedAmount };
}

export function bankUid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type BankScheduleMode = "auto" | "manual";

/** جدول اقساط: حالت خودکار (تقسیم مساوی، قسط آخر مابقی) یا دستی (جمع دقیقاً برابر کل) */
export function makeSchedule(input: {
  total: number;
  months: number;
  firstDue: string;
  mode: BankScheduleMode;
  manualText?: string;
}): BankLoanInstallment[] {
  const total = Number(input.total);
  const months = Math.floor(Number(input.months));
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("کل بدهی وام معتبر نیست.");
  }
  if (!Number.isFinite(months) || months <= 0) {
    throw new Error("تعداد اقساط معتبر نیست.");
  }
  let amounts: number[] = [];
  if (input.mode === "manual") {
    amounts = normalizeDigits(String(input.manualText ?? ""))
      .split(/[\n,،]+/)
      .map((x) => Number(x.replace(/[\u066c\u060c\s]/g, "").trim()))
      .filter((x) => Number.isFinite(x) && x > 0);
    const sum = amounts.reduce((a, b) => a + b, 0);
    if (amounts.length !== months || Math.abs(sum - total) > 0.01) {
      throw new Error(
        "تعداد مبلغ‌ها باید با تعداد ماه‌ها برابر باشد و جمع آن‌ها دقیقاً برابر کل بدهی شود.",
      );
    }
  } else {
    const base = Math.floor(total / months);
    amounts = Array(months).fill(base);
    amounts[months - 1] += total - base * months;
  }
  const first = jalaliToDate(input.firstDue);
  if (!first) {
    throw new Error("تاریخ اولین قسط را شمسی و به شکل ۱۴۰۵/۰۸/۲۷ وارد کنید.");
  }
  first.setHours(12, 0, 0, 0);
  return amounts.map((amount, i) => {
    const year = first.getFullYear();
    const month = first.getMonth() + i;
    const day = Math.min(first.getDate(), new Date(year, month + 1, 0).getDate());
    const due = new Date(year, month, day, 12, 0, 0);
    return { id: bankUid(), number: i + 1, amount, dueAt: due.toISOString() };
  });
}

// ---------- اعتبار، تعهد و بدهی عضو ----------

/** اعتبار عضو = جمع همه واریزی‌های سهام همان عضو */
export function memberClaim(deposits: BankDeposit[], memberId: string): number {
  return deposits
    .filter((d) => d.memberId === memberId && (d.type || "share") === "share")
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
}

export type BankShareDue = {
  /** تعهد ماهانه = تعداد سهم × مبلغ هر سهم */
  monthlyDue: number;
  /** بخش پرداخت‌شده از تعهد ماه جاری */
  paidThisMonth: number;
  /** مانده تعهد ماه جاری */
  left: number;
  /** اعتبار قابل استفاده ابتدای ماه (مازاد واریزی ماه‌های قبل بر تعهد آن‌ها) */
  priorCarry: number;
  /** priorCarry + واریزی این ماه */
  available: number;
  /** کل واریزی سهام تا این ماه */
  totalSharePaid: number;
  /** کل تعهد سهام از ماه عضویت تا این ماه */
  totalShareDue: number;
  /** موجودی/اعتبار نهایی عضو = کل واریزی − کل تعهد */
  balance: number;
  /** اعتبار (جمع واریزی سهام) — فیچر اصلی نمونه */
  credit: number;
  /** تعهد پرداخت‌نشده عقب‌افتاده */
  overdue: boolean;
};

export function memberShareDue(
  member: Pick<BankMember, "id" | "shares" | "createdAt">,
  deposits: BankDeposit[],
  amountPerShare: number,
  now: Date = new Date(),
): BankShareDue {
  const monthlyDue =
    Math.max(0, Number(member.shares || 0)) * Math.max(0, Number(amountPerShare || 0));
  const currentKey = monthKey(now);
  const currentSerial = jalaliMonthSerial(currentKey);
  const shareRows = deposits.filter(
    (d) => d.memberId === member.id && (d.type || "share") === "share",
  );
  const firstKey = member.createdAt
    ? monthKey(member.createdAt)
    : shareRows.length
      ? shareRows
          .map((d) => depositPeriod(d))
          .sort((a, b) => jalaliMonthSerial(a) - jalaliMonthSerial(b))[0]
      : currentKey;
  const firstSerial = jalaliMonthSerial(firstKey);
  const priorDue = Math.max(0, currentSerial - firstSerial) * monthlyDue;
  const priorPaid = shareRows
    .filter((d) => jalaliMonthSerial(depositPeriod(d)) < currentSerial)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const currentPaid = shareRows
    .filter((d) => depositPeriod(d) === currentKey)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const priorCarry = Math.max(0, priorPaid - priorDue);
  const available = priorCarry + currentPaid;
  const left = Math.max(0, monthlyDue - available);
  const paid = Math.min(monthlyDue, available);
  const totalSharePaid = priorPaid + currentPaid;
  const totalShareDue = priorDue + monthlyDue;
  const balance = totalSharePaid - totalShareDue;
  return {
    monthlyDue,
    paidThisMonth: paid,
    left,
    priorCarry,
    available,
    totalSharePaid,
    totalShareDue,
    balance,
    credit: memberClaim(deposits, member.id),
    overdue: left > 0,
  };
}

/** بدهی عضو = مانده وام‌ها + مانده تعهد سهام */
export function memberDebt(
  member: Pick<BankMember, "id" | "shares" | "createdAt">,
  deposits: BankDeposit[],
  loans: BankLoan[],
  amountPerShare: number,
  now: Date = new Date(),
): number {
  const loanDebt = loans
    .filter((l) => l.memberId === member.id)
    .reduce((sum, l) => sum + loanRemaining(l), 0);
  const share = memberShareDue(member, deposits, amountPerShare, now);
  return loanDebt + share.left;
}

// ---------- خلاصه صندوق و گردش ماهانه ----------

export type BankFundSummary = {
  totalShares: number;
  balance: number;
  totalInterest: number;
};

/** موجودی صندوق = همه واریزی‌ها + بازپرداخت‌ها − مبالغ پرداختی وام */
export function recalcFund(
  bank: Pick<BankDatabase, "members" | "deposits" | "loans">,
): BankFundSummary {
  const totalShares = bank.members.reduce((sum, m) => sum + Number(m.shares || 0), 0);
  const allDeposits = bank.deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const repayments = bank.loans.reduce((sum, l) => sum + loanPaid(l), 0);
  const loanOut = bank.loans.reduce(
    (sum, l) => sum + Number(l.disbursedAmount ?? l.principal ?? 0),
    0,
  );
  const recordedInterest = bank.deposits
    .filter((d) => d.type === "loan_interest")
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const settledInterest = bank.loans
    .filter((l) => loanRemaining(l) <= 0)
    .reduce((sum, l) => sum + Number(l.interestAmount || 0), 0);
  return {
    totalShares,
    balance: allDeposits + repayments - loanOut,
    totalInterest: recordedInterest + settledInterest,
  };
}

export type BankMonthlyRow = {
  key: string;
  share: number;
  interest: number;
  profit: number;
  repayment: number;
  loanOut: number;
};

/** گردش ماهانه بر کلید ماه شمسی؛ واریزی متفرقه در ستون profit جمع می‌شود (مطابق نمونه) */
export function monthlyTotals(
  bank: Pick<BankDatabase, "deposits" | "loans">,
): BankMonthlyRow[] {
  const map = new Map<string, BankMonthlyRow>();
  const add = (
    date: Date | string | number,
    kind: Exclude<keyof BankMonthlyRow, "key">,
    amount: number,
  ) => {
    const key = monthKey(date);
    if (!map.has(key)) {
      map.set(key, { key, share: 0, interest: 0, profit: 0, repayment: 0, loanOut: 0 });
    }
    map.get(key)![kind] += Number(amount || 0);
  };
  bank.deposits.forEach((d) => {
    const kind =
      (d.type || "share") === "share"
        ? "share"
        : d.type === "loan_interest"
          ? "interest"
          : "profit";
    add(d.createdAt, kind, d.amount);
  });
  bank.loans.forEach((l) => {
    add(l.createdAt, "loanOut", Number(l.disbursedAmount ?? l.principal ?? 0));
    (l.payments || []).forEach((p) => add(p.paidAt, "repayment", p.amount));
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

// ---------- قفل مدیر (PIN — فقط قفل ظاهری UI، مطابق نمونه) ----------

/** هش SHA-256 (crypto.subtle) برای PIN مدیر؛ هش در localStorage ذخیره می‌شود، نه داده سرور */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- خروجی CSV (استپ ۱۷ — سازگار Excel) ----------

/** ساخت رشته CSV: جداکننده ویرگول، خط CRLF، escape کوتیشن — خام، بدون BOM */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map((row) =>
    row.map(escape).join(","),
  );
  return lines.join("\r\n");
}
