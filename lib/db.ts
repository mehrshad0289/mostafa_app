import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import seed from "@/data/db.json";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { bankUid, jalaliParts, jalaliToDate, loanRemaining, loanTotals, makeSchedule, parseSharePeriod, RECEIPT_MAX_CHARS } from "./bank";

export { RECEIPT_MAX_CHARS };
export type ItemKind = "general" | "haqiqi";

export type Item = {
  id: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string;
  kind: ItemKind;
};

const KINDS: ItemKind[] = ["general", "haqiqi"];

export function normalizeKind(kind: unknown): ItemKind {
  return KINDS.includes(kind as ItemKind) ? (kind as ItemKind) : "general";
}

export function parseKind(value: string | null): ItemKind | undefined {
  return KINDS.includes(value as ItemKind) ? (value as ItemKind) : undefined;
}

// ---------- فم بانک: مدل داده مطابق docs/BANK_SPEC.md ----------

export type BankDepositType = "share" | "loan_interest" | "profit" | "misc";

export type BankSettings = {
  amountPerShare: number;
  depositTitles: string[];
  duplicateWarning: boolean;
};

export type BankMember = {
  id: string;
  name: string;
  shares: number;
  phone: string;
  gender: "male" | "female";
  note: string;
  totalDeposited: number;
  settled: boolean;
  settledAt: string | null;
  settlementClaim: number | null;
  settlementDebt: number | null;
  settlementNet: number | null;
  createdAt: string;
};

export type BankDeposit = {
  id: string;
  memberId: string | null;
  memberName: string;
  type: BankDepositType;
  title: string;
  amount: number;
  periodKey: string;
  createdAt: string;
};

export type BankLoanInstallment = {
  id: string;
  number: number;
  amount: number;
  dueAt: string;
};

export type BankLoanPayment = {
  id: string;
  amount: number;
  paidAt: string;
  note: string;
};

export type BankLoan = {
  id: string;
  memberId: string;
  memberName: string;
  principal: number;
  interestMode: "beginning" | "end";
  interestAmount: number;
  totalAmount: number;
  disbursedAmount: number;
  installmentCount: number;
  schedule: BankLoanInstallment[];
  payments: BankLoanPayment[];
  status: "active" | "paid" | "cancelled";
  note: string;
  createdAt: string;
};

export type BankAudit = {
  id: string;
  at: string;
  action: string;
  kind: string;
  recordId: string;
  detail: string;
};

export type BankDatabase = {
  settings: BankSettings;
  members: BankMember[];
  deposits: BankDeposit[];
  loans: BankLoan[];
  auditLog: BankAudit[];
};

export const DEFAULT_BANK: BankDatabase = {
  settings: {
    amountPerShare: 500000,
    depositTitles: ["سهم ماهانه", "سود وام", "واریزی سود", "واریزی متفرقه"],
    duplicateWarning: true,
  },
  members: [],
  deposits: [],
  loans: [],
  auditLog: [],
};

function normalizeBank(bank: Partial<BankDatabase> | undefined): BankDatabase {
  return {
    settings:
      bank && bank.settings && typeof bank.settings === "object"
        ? { ...DEFAULT_BANK.settings, ...bank.settings }
        : { ...DEFAULT_BANK.settings },
    members: bank && Array.isArray(bank.members) ? bank.members : [],
    deposits: bank && Array.isArray(bank.deposits) ? bank.deposits : [],
    loans: bank && Array.isArray(bank.loans) ? bank.loans : [],
    auditLog: bank && Array.isArray(bank.auditLog) ? bank.auditLog : [],
  };
}

type Database = {
  items: Item[];
  bank: BankDatabase;
  users: User[];
  sessions: Session[];
  paymentRequests: PaymentRequest[];
  loanRequests: LoanRequest[];
};

const SOURCE_FILE = path.join(process.cwd(), "data", "db.json");
const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "mostafa-app-db.json")
  : SOURCE_FILE;

// ---------- ذخیره‌سازی دائمی در Supabase (PostgreSQL) — جایگزین KV و فایل JSON ----------
// قبل از این تغییر، داده روی Vercel در /tmp (به‌ازای هر instance جدا) نگه‌داری
// می‌شد و با سرد شدن سرور/Redeploy پاک می‌شد. حالا کل داده در ۹ جدول Supabase
// ذخیره می‌شود (schema در supabase/migrations/) و بعد از Redeploy یا سرد شدن
// سرور هم می‌ماند. طبق مأموریت فقط از دو متغیر NEXT_PUBLIC_SUPABASE_URL و
// NEXT_PUBLIC_SUPABASE_ANON_KEY استفاده می‌شود (بدون Secret Key، بدون RLS).
// الگوی کد دست‌نخورده مانده است: هر عملیات readDb → تغییر شیء → writeDb؛ فقط
// backend همین دو تابع عوض شده است. متغیرها نباشند (اجرای محلی بدون دیتابیس)
// مثل قبل از فایل data/db.json استفاده می‌شود.
//
// حفظ ترتیب آرایه‌ها: ترتیب رکوردهای مدل (مثلاً جدیدترین آیتم اول) باید بعد از
// خواندن دقیقاً همان باشد؛ برای این کار هر ردیف ستون ord دارد. جدول‌های
// «جدیدترین اول» (همه به‌جز users) با ORDER BY ord DESC خوانده می‌شوند و ord =
// -رتبه در آرایه ذخیره می‌شود؛ users (که append می‌شود) با ORDER BY ord ASC.
// ردیف‌های جدید مقدار میانی بین همسایه‌هایشان می‌گیرند تا افزودن به اول/وسط هم
// بدون بازنویسی بقیه ردیف‌ها درست کار کند. ردیف تغییرنکرده دوباره ارسال نمی‌شود
// (مهم برای رسیدهای بزرگ درخواست‌های پرداخت).

type Row = Record<string, unknown>;

/** شکل ردیف هر جدول + نگاشت دوطرفه به مدل داده */
type TableSpec = {
  name: string;
  order: "asc" | "desc";
  pick: (db: Database) => unknown[];
  toRow: (entity: unknown) => Row;
};

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

function itemToRow(i: Item): Row {
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    note: i.note,
    done: i.done === true,
    created_at: i.createdAt,
  };
}

function itemFromRow(r: Row): Item {
  return {
    id: str(r.id),
    kind: normalizeKind(r.kind),
    title: str(r.title),
    note: str(r.note),
    done: bool(r.done),
    createdAt: str(r.created_at),
  };
}

function userToRow(u: User): Row {
  return {
    id: u.id,
    username: u.username,
    password_hash: u.passwordHash,
    salt: u.salt,
    role: u.role,
    full_name: u.fullName,
    phone: u.phone,
    member_id: u.memberId ?? null,
    active: u.active !== false,
    password_login_enabled: u.passwordLoginEnabled !== false,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

function userFromRow(r: Row): User {
  return {
    id: str(r.id),
    username: str(r.username),
    passwordHash: str(r.password_hash),
    salt: str(r.salt),
    role: r.role === "admin" ? "admin" : "member",
    fullName: str(r.full_name),
    phone: str(r.phone),
    memberId: r.member_id == null ? null : str(r.member_id),
    active: r.active !== false,
    passwordLoginEnabled: r.password_login_enabled !== false,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function settingsToRow(s: BankSettings): Row {
  return {
    id: 1,
    amount_per_share: num(s.amountPerShare),
    deposit_titles: Array.isArray(s.depositTitles) ? s.depositTitles : [],
    duplicate_warning: s.duplicateWarning === true,
  };
}

function settingsFromRow(r: Row): BankSettings {
  return {
    amountPerShare: num(r.amount_per_share),
    depositTitles: Array.isArray(r.deposit_titles)
      ? (r.deposit_titles as string[])
      : [...DEFAULT_BANK.settings.depositTitles],
    duplicateWarning: bool(r.duplicate_warning),
  };
}

function memberToRow(m: BankMember): Row {
  return {
    id: m.id,
    name: m.name,
    shares: num(m.shares),
    phone: m.phone,
    gender: m.gender === "female" ? "female" : "male",
    note: m.note,
    total_deposited: num(m.totalDeposited),
    settled: m.settled === true,
    settled_at: m.settledAt ?? null,
    settlement_claim: m.settlementClaim ?? null,
    settlement_debt: m.settlementDebt ?? null,
    settlement_net: m.settlementNet ?? null,
    created_at: m.createdAt,
  };
}

function memberFromRow(r: Row): BankMember {
  return {
    id: str(r.id),
    name: str(r.name),
    shares: num(r.shares),
    phone: str(r.phone),
    gender: r.gender === "female" ? "female" : "male",
    note: str(r.note),
    totalDeposited: num(r.total_deposited),
    settled: bool(r.settled),
    settledAt: r.settled_at == null ? null : str(r.settled_at),
    settlementClaim: r.settlement_claim == null ? null : num(r.settlement_claim),
    settlementDebt: r.settlement_debt == null ? null : num(r.settlement_debt),
    settlementNet: r.settlement_net == null ? null : num(r.settlement_net),
    createdAt: str(r.created_at),
  };
}

function depositToRow(d: BankDeposit): Row {
  return {
    id: d.id,
    member_id: d.memberId ?? null,
    member_name: d.memberName,
    type: d.type,
    title: d.title,
    amount: num(d.amount),
    period_key: d.periodKey,
    created_at: d.createdAt,
  };
}

function depositFromRow(r: Row): BankDeposit {
  return {
    id: str(r.id),
    memberId: r.member_id == null ? null : str(r.member_id),
    memberName: str(r.member_name),
    type: normalizeDepositType(r.type) ?? "share",
    title: str(r.title),
    amount: num(r.amount),
    periodKey: str(r.period_key),
    createdAt: str(r.created_at),
  };
}

function loanToRow(l: BankLoan): Row {
  return {
    id: l.id,
    member_id: l.memberId,
    member_name: l.memberName,
    principal: num(l.principal),
    interest_mode: l.interestMode === "end" ? "end" : "beginning",
    interest_amount: num(l.interestAmount),
    total_amount: num(l.totalAmount),
    disbursed_amount: num(l.disbursedAmount),
    installment_count: Math.round(num(l.installmentCount)),
    schedule: Array.isArray(l.schedule) ? l.schedule : [],
    payments: Array.isArray(l.payments) ? l.payments : [],
    status: l.status === "paid" || l.status === "cancelled" ? l.status : "active",
    note: l.note,
    created_at: l.createdAt,
  };
}

function loanFromRow(r: Row): BankLoan {
  return {
    id: str(r.id),
    memberId: str(r.member_id),
    memberName: str(r.member_name),
    principal: num(r.principal),
    interestMode: r.interest_mode === "end" ? "end" : "beginning",
    interestAmount: num(r.interest_amount),
    totalAmount: num(r.total_amount),
    disbursedAmount: num(r.disbursed_amount),
    installmentCount: Math.round(num(r.installment_count)),
    schedule: Array.isArray(r.schedule) ? (r.schedule as BankLoanInstallment[]) : [],
    payments: Array.isArray(r.payments) ? (r.payments as BankLoanPayment[]) : [],
    status: r.status === "paid" || r.status === "cancelled" ? r.status : "active",
    note: str(r.note),
    createdAt: str(r.created_at),
  };
}

function auditToRow(a: BankAudit): Row {
  return {
    id: a.id,
    at: a.at,
    action: a.action,
    kind: a.kind,
    record_id: a.recordId,
    detail: a.detail,
  };
}

function auditFromRow(r: Row): BankAudit {
  return {
    id: str(r.id),
    at: str(r.at),
    action: str(r.action),
    kind: str(r.kind),
    recordId: str(r.record_id),
    detail: str(r.detail),
  };
}

function paymentRequestToRow(p: PaymentRequest): Row {
  return {
    id: p.id,
    kind: p.kind === "installment" ? "installment" : "share",
    member_id: p.memberId,
    user_id: p.userId,
    username: p.username,
    amount: num(p.amount),
    receipt: p.receipt,
    note: p.note,
    status: p.status,
    loan_id: p.loanId ?? null,
    installment_number: p.installmentNumber == null ? null : Math.round(num(p.installmentNumber)),
    created_at: p.createdAt,
    reviewed_at: p.reviewedAt ?? null,
    review_note: p.reviewNote ?? null,
  };
}

function paymentRequestFromRow(r: Row): PaymentRequest {
  return {
    id: str(r.id),
    kind: r.kind === "installment" ? "installment" : "share",
    memberId: str(r.member_id),
    userId: str(r.user_id),
    username: str(r.username),
    amount: num(r.amount),
    receipt: str(r.receipt),
    note: str(r.note),
    status: r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "pending",
    loanId: r.loan_id == null ? undefined : str(r.loan_id),
    installmentNumber: r.installment_number == null ? undefined : Math.round(num(r.installment_number)),
    createdAt: str(r.created_at),
    reviewedAt: r.reviewed_at == null ? undefined : str(r.reviewed_at),
    reviewNote: r.review_note == null ? undefined : str(r.review_note),
  };
}

function loanRequestToRow(q: LoanRequest): Row {
  return {
    id: q.id,
    member_id: q.memberId,
    user_id: q.userId,
    username: q.username,
    amount: num(q.amount),
    months: Math.round(num(q.months)),
    reason: q.reason,
    status: q.status,
    created_at: q.createdAt,
    reviewed_at: q.reviewedAt ?? null,
    review_note: q.reviewNote ?? null,
  };
}

function loanRequestFromRow(r: Row): LoanRequest {
  return {
    id: str(r.id),
    memberId: str(r.member_id),
    userId: str(r.user_id),
    username: str(r.username),
    amount: num(r.amount),
    months: Math.round(num(r.months)),
    reason: str(r.reason),
    status: r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "pending",
    createdAt: str(r.created_at),
    reviewedAt: r.reviewed_at == null ? undefined : str(r.reviewed_at),
    reviewNote: r.review_note == null ? undefined : str(r.review_note),
  };
}

const TABLES: TableSpec[] = [
  { name: "items", order: "desc", pick: (db) => db.items, toRow: (e) => itemToRow(e as Item) },
  { name: "users", order: "asc", pick: (db) => db.users, toRow: (e) => userToRow(e as User) },
  { name: "bank_settings", order: "asc", pick: (db) => [db.bank.settings], toRow: (e) => settingsToRow(e as BankSettings) },
  { name: "bank_members", order: "desc", pick: (db) => db.bank.members, toRow: (e) => memberToRow(e as BankMember) },
  { name: "bank_deposits", order: "desc", pick: (db) => db.bank.deposits, toRow: (e) => depositToRow(e as BankDeposit) },
  { name: "bank_loans", order: "desc", pick: (db) => db.bank.loans, toRow: (e) => loanToRow(e as BankLoan) },
  { name: "bank_audit", order: "desc", pick: (db) => db.bank.auditLog, toRow: (e) => auditToRow(e as BankAudit) },
  { name: "payment_requests", order: "desc", pick: (db) => db.paymentRequests, toRow: (e) => paymentRequestToRow(e as PaymentRequest) },
  { name: "loan_requests", order: "desc", pick: (db) => db.loanRequests, toRow: (e) => loanRequestToRow(e as LoanRequest) },
];

/** آخرین وضعیت ردیف‌ها که از دیتابیس خوانده/نوشته شده — مبنا تشخیص تغییرات */
type Snap = Partial<Record<string, Row[]>>;
let snap: Snap | null = null;

/**
 * کپی عمیق snapshot: ردیف‌ها حاوی ارجاع به آرایه‌های زنده مدل داده‌اند
 * (schedule/payments/deposit_titles)؛ اگر clone نشوند، تغییر درجای همان آرایه‌ها
 * در snapshot هم دیده می‌شود و rowsEqual تغییر را نمی‌بیند و write خام می‌ماند.
 */
function cloneSnap(source: Record<string, Row[]>): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const key of Object.keys(source)) {
    out[key] = JSON.parse(JSON.stringify(source[key])) as Row[];
  }
  return out;
}

/** مقایسه دو ردیف: فیلدهای تخت با === (سریع، حتی برای رسیدهای بزرگ) و آبجکت‌ها با stringify */
function rowsEqual(a: Row, b: Row): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    const va = a[key];
    const vb = b[key];
    if (va !== null && typeof va === "object") {
      if (JSON.stringify(va) !== JSON.stringify(vb)) return false;
    } else if (va !== vb) return false;
  }
  return true;
}

/**
 * ساخت ردیف‌های یک جدول از روی آرایه مدل داده. ردیف‌های موجود ord خودشان را
 * نگه می‌دارند و ردیف‌های جدید مقدار میانی بین همسایه‌ها می‌گیرند؛ برای
 * جدول‌های «جدیدترین اول» علامت منفی می‌خورند تا ORDER BY ord DESC همان ترتیب
 * آرایه را برگرداند.
 */
function buildRows(spec: TableSpec, entities: unknown[], snapRows: Row[] | undefined): Row[] {
  const desc = spec.order === "desc";
  const snapOrd = new Map<string, number>();
  if (snapRows) {
    for (const r of snapRows) {
      const ord = Number(r.ord ?? 0);
      snapOrd.set(str(r.id), desc ? -ord : ord);
    }
  }
  const ids = entities.map((e) => str(spec.toRow(e).id));
  const rows: Row[] = [];
  let prev: number | null = null;
  for (let i = 0; i < entities.length; i++) {
    const row = spec.toRow(entities[i]);
    const known = snapOrd.get(str(row.id));
    if (known !== undefined) {
      prev = known;
      rows.push({ ...row, ord: desc ? -known : known });
      continue;
    }
    let next: number | null = null;
    for (let j = i + 1; j < entities.length; j++) {
      const found = snapOrd.get(ids[j]);
      if (found !== undefined) {
        next = found;
        break;
      }
    }
    if (next === null) next = (prev ?? -1) + 2;
    if (prev === null) prev = next - 2;
    const at: number = (prev + next) / 2;
    prev = at;
    rows.push({ ...row, ord: desc ? -at : at });
  }
  return rows;
}

/** حالت ذخیره‌سازی فعلی: «supabase» یعنی ماندگار در دیتابیس؛ «file» فقط اجرای محلی بدون متغیرها */
export function storageMode(): "supabase" | "file" {
  return getSupabase() ? "supabase" : "file";
}

/** خواندن همه جدول‌ها به‌صورت موازی و بازسازی مدل داده */
async function sbReadAll(
  client: SupabaseClient,
): Promise<{ parsed: Partial<Database>; rows: Record<string, Row[]> }> {
  const [itemsQ, usersQ, settingsQ, membersQ, depositsQ, loansQ, auditQ, payQ, loanQ] =
    await Promise.all([
      client.from("items").select("*").order("ord", { ascending: false }),
      client.from("users").select("*").order("ord", { ascending: true }),
      client.from("bank_settings").select("*").eq("id", 1).maybeSingle(),
      client.from("bank_members").select("*").order("ord", { ascending: false }),
      client.from("bank_deposits").select("*").order("ord", { ascending: false }),
      client.from("bank_loans").select("*").order("ord", { ascending: false }),
      client.from("bank_audit").select("*").order("ord", { ascending: false }),
      client.from("payment_requests").select("*").order("ord", { ascending: false }),
      client.from("loan_requests").select("*").order("ord", { ascending: false }),
    ]);
  const error =
    itemsQ.error ??
    usersQ.error ??
    settingsQ.error ??
    membersQ.error ??
    depositsQ.error ??
    loansQ.error ??
    auditQ.error ??
    payQ.error ??
    loanQ.error;
  if (error) throw error;

  const rows: Record<string, Row[]> = {
    items: (itemsQ.data ?? []) as Row[],
    users: (usersQ.data ?? []) as Row[],
    bank_settings: settingsQ.data ? [settingsQ.data as Row] : [],
    bank_members: (membersQ.data ?? []) as Row[],
    bank_deposits: (depositsQ.data ?? []) as Row[],
    bank_loans: (loansQ.data ?? []) as Row[],
    bank_audit: (auditQ.data ?? []) as Row[],
    payment_requests: (payQ.data ?? []) as Row[],
    loan_requests: (loanQ.data ?? []) as Row[],
  };

  const parsed: Partial<Database> = {
    items: rows.items.map(itemFromRow),
    users: rows.users.map(userFromRow),
    bank: {
      settings: rows.bank_settings.length
        ? settingsFromRow(rows.bank_settings[0])
        : { ...DEFAULT_BANK.settings },
      members: rows.bank_members.map(memberFromRow),
      deposits: rows.bank_deposits.map(depositFromRow),
      loans: rows.bank_loans.map(loanFromRow),
      auditLog: rows.bank_audit.map(auditFromRow),
    },
    sessions: [],
    paymentRequests: rows.payment_requests.map(paymentRequestFromRow),
    loanRequests: rows.loan_requests.map(loanRequestFromRow),
  };
  return { parsed, rows };
}

/**
 * همگام‌سازی مدل داده با جدول‌ها: فقط ردیف‌های تغییرکرده upsert و ردیف‌های حذف‌شده
 * delete می‌شوند. اگر snapshot خواندن موجود نبود (خطای موقت خواندن)، فقط upsert
 * انجام می‌شود و هیچ چیزی حذف نمی‌شود تا داده‌ای از دست نرود.
 */
async function sbSyncAll(client: SupabaseClient, db: Database) {
  const nextRows: Record<string, Row[]> = {};
  await Promise.all(
    TABLES.map(async (spec) => {
      const entities = spec.pick(db);
      const prevRows = snap?.[spec.name];
      const rows = buildRows(spec, entities, prevRows);
      nextRows[spec.name] = rows;
      if (!prevRows) {
        if (rows.length) {
          const { error } = await client.from(spec.name).upsert(rows);
          if (error) throw error;
        }
        return;
      }
      const prevById = new Map(prevRows.map((r) => [str(r.id), r]));
      const dirty = rows.filter((r) => {
        const before = prevById.get(str(r.id));
        return !before || !rowsEqual(before, r);
      });
      const currentIds = new Set(rows.map((r) => str(r.id)));
      const removed = prevRows
        .filter((r) => !currentIds.has(str(r.id)))
        .map((r) => str(r.id));
      if (dirty.length) {
        const { error } = await client.from(spec.name).upsert(dirty);
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await client.from(spec.name).delete().in("id", removed);
        if (error) throw error;
      }
    }),
  );
  snap = cloneSnap(nextRows);
}

/**
 * مایگریشن داده کاربران: رکوردهای قدیمی که فیلدهای passwordLoginEnabled و
 * updatedAt را ندارند تکمیل می‌شوند (پیش‌فرض: ورود با رمز مجاز). رکوردهای ناقص
 * (بدون id/username/hash) کنار گذاشته می‌شوند تا هرگز نشست نامعتبر ساخته نشود.
 */
function normalizeUsers(users: unknown): User[] {
  if (!Array.isArray(users)) return [];
  const out: User[] = [];
  for (const raw of users) {
    if (!raw || typeof raw !== "object") continue;
    const u = raw as Partial<User>;
    if (
      typeof u.id !== "string" ||
      typeof u.username !== "string" ||
      typeof u.passwordHash !== "string" ||
      typeof u.salt !== "string"
    ) {
      continue;
    }
    out.push({
      id: u.id,
      username: u.username,
      passwordHash: u.passwordHash,
      salt: u.salt,
      role: u.role === "admin" ? "admin" : "member",
      fullName: typeof u.fullName === "string" ? u.fullName : "",
      phone: typeof u.phone === "string" ? u.phone : "",
      memberId: typeof u.memberId === "string" ? u.memberId : null,
      active: u.active !== false,
      passwordLoginEnabled: u.passwordLoginEnabled !== false,
      createdAt:
        typeof u.createdAt === "string" ? u.createdAt : "2026-01-01T00:00:00.000Z",
      updatedAt:
        typeof u.updatedAt === "string" ? u.updatedAt : "2026-01-01T00:00:00.000Z",
    });
  }
  return out;
}

function normalizeDb(parsed: Partial<Database>): Database {
  const db: Database = {
    items: (parsed.items ?? seed.items).map((item) => ({
      ...item,
      kind: normalizeKind(item.kind),
    })),
    bank: normalizeBank(parsed.bank),
    users: normalizeUsers(parsed.users),
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    paymentRequests: Array.isArray(parsed.paymentRequests) ? parsed.paymentRequests : [],
    loanRequests: Array.isArray(parsed.loanRequests) ? parsed.loanRequests : [],
  };
  ensureDefaultAdmin(db);
  return db;
}

async function readDb(): Promise<Database> {
  const client = getSupabase();
  if (client) {
    try {
      const { parsed, rows } = await sbReadAll(client);
      snap = cloneSnap(rows);
      return normalizeDb(parsed);
    } catch (err) {
      // خطای موقت خواندن: مثل نبودِ داده رفتار می‌کنیم (داده seed)؛ در این حالت
      // writeDb فقط upsert می‌کند و هیچ چیز حذف نمی‌کند تا داده از دست نرود.
      console.error("supabase: خواندن دیتابیس ناموفق بود؛ داده seed استفاده می‌شود:", err);
      snap = null;
      return normalizeDb({} as Partial<Database>);
    }
  }
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return normalizeDb(JSON.parse(raw) as Partial<Database>);
  } catch {
    return normalizeDb(seed as Partial<Database>);
  }
}

async function writeDb(db: Database) {
  const client = getSupabase();
  if (client) {
    try {
      await sbSyncAll(client, db);
      return;
    } catch (err) {
      // آخرین لایه محافظت: اگر نوشتن در Supabase موقتاً شکست بخورد، همان فراخوانی
      // در فایل محلی/tmp ذخیره می‌شود تا عملیات کاربر از دست نرود.
      console.error("supabase: نوشتن ناموفق بود؛ ذخیره در فایل:", err);
    }
  }
  const raw = JSON.stringify(db, null, 2);
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, raw, "utf8");
}

export async function getItems(kind?: ItemKind) {
  const db = await readDb();
  return kind ? db.items.filter((item) => item.kind === kind) : db.items;
}

export async function createItem(input: {
  title: string;
  note: string;
  kind?: ItemKind;
}) {
  const db = await readDb();
  const item: Item = {
    id: Date.now().toString(),
    title: input.title.trim(),
    note: input.note.trim(),
    done: false,
    createdAt: new Date().toISOString(),
    kind: normalizeKind(input.kind),
  };
  db.items.unshift(item);
  await writeDb(db);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<Item, "title" | "note" | "done">>,
) {
  const db = await readDb();
  const index = db.items.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }
  db.items[index] = { ...db.items[index], ...patch };
  await writeDb(db);
  return db.items[index];
}

export async function deleteItem(id: string) {
  const db = await readDb();
  const next = db.items.filter((item) => item.id !== id);
  if (next.length === db.items.length) {
    return false;
  }
  db.items = next;
  await writeDb(db);
  return true;
}

// ---------- فم بانک: ذخیره‌سازی و عملیات اعضا ----------

const AUDIT_LIMIT = 1000;

function addAudit(
  bank: BankDatabase,
  action: string,
  kind: string,
  recordId: string,
  detail: string,
) {
  bank.auditLog.unshift({
    id: bankUid(),
    at: new Date().toISOString(),
    action,
    kind,
    recordId,
    detail,
  });
  if (bank.auditLog.length > AUDIT_LIMIT) {
    bank.auditLog.length = AUDIT_LIMIT;
  }
}

export async function getBank(): Promise<BankDatabase> {
  const db = await readDb();
  return db.bank;
}

export async function createBankMember(input: {
  name: string;
  shares: number;
  phone?: string;
  gender?: BankMember["gender"];
  note?: string;
}): Promise<BankMember> {
  const db = await readDb();
  const member: BankMember = {
    id: bankUid(),
    name: input.name.trim(),
    shares: input.shares,
    phone: input.phone?.trim() ?? "",
    gender: input.gender === "female" ? "female" : "male",
    note: input.note?.trim() ?? "",
    totalDeposited: 0,
    settled: false,
    settledAt: null,
    settlementClaim: null,
    settlementDebt: null,
    settlementNet: null,
    createdAt: new Date().toISOString(),
  };
  db.bank.members.unshift(member);
  addAudit(db.bank, "ثبت", "عضو", member.id, `عضو «${member.name}» با ${member.shares} سهم ثبت شد.`);
  await writeDb(db);
  return member;
}

export async function updateBankMember(
  id: string,
  patch: Partial<Pick<BankMember, "name" | "shares" | "phone" | "gender" | "note">>,
): Promise<BankMember | null> {
  const db = await readDb();
  const index = db.bank.members.findIndex((m) => m.id === id);
  if (index === -1) {
    return null;
  }
  const next: BankMember = { ...db.bank.members[index] };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.shares !== undefined) next.shares = patch.shares;
  if (patch.phone !== undefined) next.phone = patch.phone.trim();
  if (patch.gender !== undefined) next.gender = patch.gender;
  if (patch.note !== undefined) next.note = patch.note.trim();
  if (JSON.stringify(next) === JSON.stringify(db.bank.members[index])) {
    return next;
  }
  db.bank.members[index] = next;
  addAudit(db.bank, "ویرایش", "عضو", id, `اطلاعات عضو «${next.name}» ویرایش شد.`);
  await writeDb(db);
  return next;
}

export async function deleteBankMember(id: string): Promise<BankMember | null> {
  const db = await readDb();
  const index = db.bank.members.findIndex((m) => m.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = db.bank.members.splice(index, 1);
  addAudit(db.bank, "حذف", "عضو", id, `عضو «${removed.name}» حذف شد.`);
  await writeDb(db);
  return removed;
}

// ---------- فم بانک: عملیات واریزی‌ها ----------

export const BANK_DEPOSIT_TYPES: BankDepositType[] = [
  "share",
  "loan_interest",
  "profit",
  "misc",
];

export function normalizeDepositType(value: unknown): BankDepositType | null {
  return BANK_DEPOSIT_TYPES.includes(value as BankDepositType)
    ? (value as BankDepositType)
    : null;
}

const DEPOSIT_TITLE_INDEX: Record<BankDepositType, number> = {
  share: 0,
  loan_interest: 1,
  profit: 2,
  misc: 3,
};

function defaultDepositTitle(bank: BankDatabase, type: BankDepositType): string {
  const titles = bank.settings.depositTitles ?? [];
  return titles[DEPOSIT_TITLE_INDEX[type]] ?? "واریزی";
}

/** totalDeposited هر عضو = جمع همه واریزی‌های همان عضو (بازمحاسبه با هر ذخیره) */
function recalcMemberTotals(bank: BankDatabase) {
  bank.members.forEach((m) => {
    m.totalDeposited = bank.deposits
      .filter((d) => d.memberId === m.id)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  });
}

function faAmount(amount: number): string {
  return Number(amount).toLocaleString("fa-IR");
}

export async function createBankDeposit(input: {
  type: BankDepositType;
  memberId: string | null;
  memberName?: string;
  title?: string;
  amount: number;
  periodKey?: string;
}): Promise<BankDeposit> {
  const db = await readDb();
  const member = input.memberId
    ? db.bank.members.find((m) => m.id === input.memberId) ?? null
    : null;
  const deposit: BankDeposit = {
    id: bankUid(),
    memberId: member ? member.id : null,
    memberName: member
      ? member.name
      : input.memberName?.trim() || "واریزی متفرقه",
    type: input.type,
    title: input.title?.trim() || defaultDepositTitle(db.bank, input.type),
    amount: input.amount,
    periodKey:
      input.type === "share" ? parseSharePeriod(input.periodKey ?? "", new Date()) : "",
    createdAt: new Date().toISOString(),
  };
  db.bank.deposits.unshift(deposit);
  recalcMemberTotals(db.bank);
  addAudit(
    db.bank,
    "ثبت",
    "واریزی",
    deposit.id,
    `واریزی «${deposit.title}» به مبلغ ${faAmount(deposit.amount)} تومان ${
      member ? `برای عضو «${member.name}»` : "بدون عضو (متفرقه)"
    } ثبت شد.`,
  );
  await writeDb(db);
  return deposit;
}

export type BankDepositPatch = {
  type?: BankDepositType;
  memberId?: string | null;
  memberName?: string;
  title?: string;
  amount?: number;
  periodKey?: string;
};

export async function updateBankDeposit(
  id: string,
  patch: BankDepositPatch,
): Promise<BankDeposit | null> {
  const db = await readDb();
  const index = db.bank.deposits.findIndex((d) => d.id === id);
  if (index === -1) {
    return null;
  }
  const prev = db.bank.deposits[index];
  const next: BankDeposit = { ...prev };
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.memberId !== undefined) {
    const member = patch.memberId
      ? db.bank.members.find((m) => m.id === patch.memberId) ?? null
      : null;
    next.memberId = member ? member.id : null;
    next.memberName = member
      ? member.name
      : patch.memberName?.trim() || "واریزی متفرقه";
  } else if (patch.memberName !== undefined && next.memberId === null) {
    next.memberName = patch.memberName.trim() || "واریزی متفرقه";
  }
  if (patch.title !== undefined && patch.title.trim()) {
    next.title = patch.title.trim();
  }
  if (patch.amount !== undefined) next.amount = patch.amount;
  if (next.type === "share") {
    next.periodKey =
      patch.periodKey !== undefined
        ? parseSharePeriod(patch.periodKey, new Date())
        : next.periodKey || parseSharePeriod("", new Date());
  } else {
    next.periodKey = "";
  }
  if (JSON.stringify(next) === JSON.stringify(prev)) {
    return next;
  }
  db.bank.deposits[index] = next;
  recalcMemberTotals(db.bank);
  addAudit(
    db.bank,
    "ویرایش",
    "واریزی",
    id,
    `واریزی «${next.title}» به مبلغ ${faAmount(next.amount)} تومان ویرایش شد.`,
  );
  await writeDb(db);
  return next;
}

export async function deleteBankDeposit(id: string): Promise<BankDeposit | null> {
  const db = await readDb();
  const index = db.bank.deposits.findIndex((d) => d.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = db.bank.deposits.splice(index, 1);
  recalcMemberTotals(db.bank);
  addAudit(
    db.bank,
    "حذف",
    "واریزی",
    id,
    `واریزی «${removed.title}» به مبلغ ${faAmount(removed.amount)} تومان حذف شد.`,
  );
  await writeDb(db);
  return removed;
}

// ---------- فم بانک: عملیات وام‌ها و اقساط ----------

export async function createBankLoan(input: {
  memberId: string;
  principal: number;
  interestAmount: number;
  interestMode: BankLoan["interestMode"];
  installmentCount: number;
  firstDue: string;
  scheduleMode: "auto" | "manual";
  manualText?: string;
  note?: string;
}): Promise<BankLoan> {
  const db = await readDb();
  const member = db.bank.members.find((m) => m.id === input.memberId);
  if (!member) {
    throw new Error("عضو انتخاب‌شده پیدا نشد.");
  }
  const { totalAmount, disbursedAmount } = loanTotals(
    input.principal,
    input.interestAmount,
    input.interestMode,
  );
  const schedule = makeSchedule({
    total: totalAmount,
    months: input.installmentCount,
    firstDue: input.firstDue,
    mode: input.scheduleMode,
    manualText: input.manualText,
  });
  const loan: BankLoan = {
    id: bankUid(),
    memberId: member.id,
    memberName: member.name,
    principal: input.principal,
    interestMode: input.interestMode,
    interestAmount: input.interestAmount,
    totalAmount,
    disbursedAmount,
    installmentCount: input.installmentCount,
    schedule,
    payments: [],
    status: "active",
    note: input.note?.trim() ?? "",
    createdAt: new Date().toISOString(),
  };
  db.bank.loans.unshift(loan);
  addAudit(
    db.bank,
    "ثبت",
    "وام",
    loan.id,
    `وام ${faAmount(input.principal)} تومانی برای عضو «${member.name}» با ${input.installmentCount} قسط و کل بازپرداخت ${faAmount(totalAmount)} تومان ثبت شد.`,
  );
  await writeDb(db);
  return loan;
}

export type BankLoanPatch = {
  note?: string;
  status?: BankLoan["status"];
  principal?: number;
  interestAmount?: number;
  interestMode?: BankLoan["interestMode"];
  installmentCount?: number;
  firstDue?: string;
  scheduleMode?: "auto" | "manual";
  manualText?: string;
};

export async function updateBankLoan(
  id: string,
  patch: BankLoanPatch,
): Promise<BankLoan | null> {
  const db = await readDb();
  const index = db.bank.loans.findIndex((l) => l.id === id);
  if (index === -1) {
    return null;
  }
  const prev = db.bank.loans[index];
  const next: BankLoan = { ...prev };
  if (patch.note !== undefined) next.note = patch.note.trim();
  if (patch.status !== undefined) next.status = patch.status;
  const hasFinancial =
    patch.principal !== undefined ||
    patch.interestAmount !== undefined ||
    patch.interestMode !== undefined ||
    patch.installmentCount !== undefined ||
    patch.firstDue !== undefined;
  if (hasFinancial) {
    const principal = patch.principal ?? prev.principal;
    const interestAmount = patch.interestAmount ?? prev.interestAmount;
    const interestMode = patch.interestMode ?? prev.interestMode;
    const installmentCount = patch.installmentCount ?? prev.installmentCount;
    // تاریخ اولین قسط: اگر داده نشد از جدول اقساط فعلی وام استخراج می‌شود
    let firstDue = patch.firstDue ?? "";
    if (!firstDue) {
      const first = prev.schedule[0]?.dueAt ? new Date(prev.schedule[0].dueAt) : new Date();
      const p = jalaliParts(first);
      firstDue = `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
    }
    const { totalAmount, disbursedAmount } = loanTotals(principal, interestAmount, interestMode);
    const schedule = makeSchedule({
      total: totalAmount,
      months: installmentCount,
      firstDue,
      mode: patch.scheduleMode ?? "auto",
      manualText: patch.manualText,
    });
    next.principal = principal;
    next.interestAmount = interestAmount;
    next.interestMode = interestMode;
    next.installmentCount = installmentCount;
    next.totalAmount = totalAmount;
    next.disbursedAmount = disbursedAmount;
    next.schedule = schedule;
  }
  if (JSON.stringify(next) === JSON.stringify(prev)) {
    return next;
  }
  db.bank.loans[index] = next;
  addAudit(
    db.bank,
    "ویرایش",
    "وام",
    id,
    `وام عضو «${next.memberName}» ویرایش شد (کل بازپرداخت فعلی ${faAmount(next.totalAmount)} تومان).`,
  );
  await writeDb(db);
  return next;
}

export async function deleteBankLoan(id: string): Promise<BankLoan | null> {
  const db = await readDb();
  const index = db.bank.loans.findIndex((l) => l.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = db.bank.loans.splice(index, 1);
  addAudit(
    db.bank,
    "حذف",
    "وام",
    id,
    `وام ${faAmount(removed.principal)} تومانی عضو «${removed.memberName}» حذف شد.`,
  );
  await writeDb(db);
  return removed;
}

export async function addBankLoanPayment(
  loanId: string,
  input: { amount: number; paidAt: string; note?: string },
): Promise<{ payment: BankLoanPayment; loan: BankLoan } | null> {
  const db = await readDb();
  const loan = db.bank.loans.find((l) => l.id === loanId);
  if (!loan) {
    return null;
  }
  const payment: BankLoanPayment = {
    id: bankUid(),
    amount: input.amount,
    paidAt: input.paidAt,
    note: input.note?.trim() ?? "",
  };
  loan.payments.push(payment);
  const remaining = loanRemaining(loan);
  if (remaining === 0 && loan.status === "active") {
    loan.status = "paid";
  }
  addAudit(
    db.bank,
    "ثبت",
    "پرداخت",
    payment.id,
    `پرداخت ${faAmount(input.amount)} تومانی برای وام عضو «${loan.memberName}» ثبت شد (مانده ${faAmount(remaining)} تومان).`,
  );
  await writeDb(db);
  return { payment, loan };
}

export async function deleteBankLoanPayment(
  loanId: string,
  paymentId: string,
): Promise<{ payment: BankLoanPayment; loan: BankLoan } | null> {
  const db = await readDb();
  const loan = db.bank.loans.find((l) => l.id === loanId);
  if (!loan) {
    return null;
  }
  const index = loan.payments.findIndex((p) => p.id === paymentId);
  if (index === -1) {
    return null;
  }
  const [removed] = loan.payments.splice(index, 1);
  if (loan.status === "paid" && loanRemaining(loan) > 0) {
    loan.status = "active";
  }
  addAudit(
    db.bank,
    "حذف",
    "پرداخت",
    paymentId,
    `پرداخت ${faAmount(removed.amount)} تومانی وام عضو «${loan.memberName}» حذف شد (مانده ${faAmount(loanRemaining(loan))} تومان).`,
  );
  await writeDb(db);
  return { payment: removed, loan };
}

// ---------- فم بانک: تسویه اعضا و تنظیمات ----------

/** ثبت یا ویرایش تسویه عضو؛ net = claim − debt */
export async function settleBankMember(
  id: string,
  input: { claim: number; debt: number },
): Promise<BankMember | null> {
  const db = await readDb();
  const member = db.bank.members.find((m) => m.id === id);
  if (!member) {
    return null;
  }
  const wasSettled = member.settled;
  member.settled = true;
  member.settledAt = new Date().toISOString();
  member.settlementClaim = input.claim;
  member.settlementDebt = input.debt;
  member.settlementNet = input.claim - input.debt;
  addAudit(
    db.bank,
    wasSettled ? "ویرایش" : "ثبت",
    "تسویه",
    member.id,
    `${wasSettled ? "ویرایش" : "ثبت"} تسویه عضو «${member.name}» — طلب ${faAmount(input.claim)}، بدهی ${faAmount(input.debt)}، خالص ${faAmount(input.claim - input.debt)} تومان.`,
  );
  await writeDb(db);
  return member;
}

/** لغو وضعیت تسویه عضو؛ false یعنی تسویه‌ای برای لغو وجود ندارد */
export async function unsettleBankMember(
  id: string,
): Promise<BankMember | false | null> {
  const db = await readDb();
  const member = db.bank.members.find((m) => m.id === id);
  if (!member) {
    return null;
  }
  if (!member.settled) {
    return false;
  }
  member.settled = false;
  member.settledAt = null;
  member.settlementClaim = null;
  member.settlementDebt = null;
  member.settlementNet = null;
  addAudit(
    db.bank,
    "لغو تسویه",
    "تسویه",
    member.id,
    `وضعیت تسویه عضو «${member.name}» لغو شد.`,
  );
  await writeDb(db);
  return member;
}

export type BankSettingsPatch = {
  amountPerShare?: number;
  depositTitles?: string[];
  duplicateWarning?: boolean;
};

export async function updateBankSettings(
  patch: BankSettingsPatch,
): Promise<BankSettings> {
  const db = await readDb();
  const settings = db.bank.settings;
  if (patch.amountPerShare !== undefined) {
    settings.amountPerShare = patch.amountPerShare;
  }
  if (patch.depositTitles !== undefined) {
    settings.depositTitles = patch.depositTitles;
  }
  if (patch.duplicateWarning !== undefined) {
    settings.duplicateWarning = patch.duplicateWarning;
  }
  await writeDb(db);
  return settings;
}

/** بازیابی کامل داده بانک از فایل پشتیبان (استپ ۱۸) — ورودی باید از قبل با
 *  اعتبارسنجی route پشتیبان پاس شده باشد؛ یک رکورد audit «بازیابی پشتیبان» ثبت می‌شود */
export async function restoreBank(input: BankDatabase): Promise<BankDatabase> {
  const db = await readDb();
  db.bank = { ...input };
  addAudit(
    db.bank,
    "بازیابی پشتیبان",
    "بانک",
    "backup",
    `داده بانک از فایل پشتیبان بازیابی شد (${input.members.length} عضو، ${input.deposits.length} واریزی، ${input.loans.length} وام).`,
  );
  await writeDb(db);
  return db.bank;
}

// ---------- کاربران و نشست‌ها (دو لایه شدن اپ) ----------

export type UserRole = "admin" | "member";

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  fullName: string;
  phone: string;
  /** اتصال کاربر به عضو بانک در بخش فم بانک (برای فیلتر داده عضو عادی) */
  memberId: string | null;
  active: boolean;
  /** اگر false باشد، ورود با رمز عبور برای این کاربر بسته است (فقط ادمین می‌تواند بازش کند) */
  passwordLoginEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = Omit<User, "passwordHash" | "salt">;

export type Session = {
  id: string;
  userId: string;
  expiresAt: string;
};

const DEFAULT_ADMIN_ID = "user-admin-default";
/** نام کاربری ادمین اصلی — برای منطق ورود بدون رمز موقت در route ورود */
export const ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "Admin@12345";
const DEFAULT_ADMIN_SALT = "mostafa-default-admin-salt-v1";

/**
 * ادمین پیش‌فرض: اگر هیچ ادمین فعالی نبود (از جمله بار اول با users خالی)،
 * خودکار ساخته می‌شود تا اولین ورود ممکن باشد. id/salt ثابت‌اند تا نشست‌های
 * ساخته‌شده در فراخوانی‌های بعدی هم معتبر بمانند. رمز پیش‌فرض باید بعد از
 * اولین ورود عوض شود.
 */
function ensureDefaultAdmin(db: Database) {
  if (db.users.some((u) => u.role === "admin" && u.active)) return;
  db.users = db.users.filter((u) => u.id !== DEFAULT_ADMIN_ID);
  db.users.unshift({
    id: DEFAULT_ADMIN_ID,
    username: ADMIN_USERNAME,
    passwordHash: scryptSync(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_SALT, 64).toString("hex"),
    salt: DEFAULT_ADMIN_SALT,
    role: "admin",
    fullName: "مدیر سیستم",
    phone: "",
    memberId: null,
    active: true,
    passwordLoginEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

/** هش رمز با scryptSync خود Node؛ اگر salt داده نشود salt جدید ساخته می‌شود */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  return {
    hash: scryptSync(password, useSalt, 64).toString("hex"),
    salt: useSalt,
  };
}

/** بررسی درستی رمز در برابر hash ذخیره‌شده (مقایسه زمان‌ثابت) */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const candidate = scryptSync(password, salt, 64);
    const stored = Buffer.from(expectedHash, "hex");
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

/** حذف hash و salt برای خروجی API */
export function sanitizeUser(user: User): PublicUser {
  const next = { ...user } as Record<string, unknown>;
  delete next.passwordHash;
  delete next.salt;
  return next as PublicUser;
}

export const SESSION_TTL_DAYS = 7;

const TOKEN_VERSION = "v1";
const TOKEN_PEPPER = "mostafa-session-v1";

/**
 * نشست بدون حالت (stateless): اطلاعات نشست در خود کوکی امضاشده زندگی می‌کند و
 * هیچ چیزی روی دیسک نوشته نمی‌شود. روی Vercel هم وقتی instance عوض می‌شود و
 * /tmp خالی می‌شود، کوکی معتبر می‌ماند (رفع بیرون‌پریدن به /login).
 * کلید امضا از هش رمزِ همان کاربر ساخته می‌شود؛ پس تغییر رمز همه توکن‌های
 * قبلی آن کاربر را باطل می‌کند و ساخت توکن بدون دانستن رمز ممکن نیست.
 */
function sessionKey(user: User): Buffer {
  return createHash("sha256")
    .update(`${user.salt}:${user.passwordHash}:${TOKEN_PEPPER}`)
    .digest();
}

/** ساخت توکن نشست: uid + تاریخ انقضا + امضای HMAC */
export function createSessionToken(
  user: User,
  ttlDays = SESSION_TTL_DAYS,
): { token: string; maxAgeSeconds: number } {
  const maxAgeSeconds = Math.round(ttlDays * 24 * 60 * 60);
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = Buffer.from(JSON.stringify({ uid: user.id, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", sessionKey(user))
    .update(`${TOKEN_VERSION}.${payload}`)
    .digest("base64url");
  return { token: `${TOKEN_VERSION}.${payload}.${sig}`, maxAgeSeconds };
}

/** خواندن کاربر معتبر از توکن کوکی؛ توکن بد/منقضی یا کاربر ناموجود/غیرفعال = null */
export async function getSessionUser(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  const parts = sessionId.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, payload, sig] = parts;
  let parsed: { uid?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: unknown;
      exp?: unknown;
    };
  } catch {
    return null;
  }
  const uid = typeof parsed.uid === "string" ? parsed.uid : "";
  if (!uid) return null;
  const db = await readDb();
  const user = db.users.find((u) => u.id === uid);
  // کاربر غیرفعال یا با «ورود با رمز» بسته → نشست بلافاصله باطل می‌شود
  if (!user || !user.active || !user.passwordLoginEnabled) return null;
  const expected = createHmac("sha256", sessionKey(user))
    .update(`${TOKEN_VERSION}.${payload}`)
    .digest("base64url");
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
  return user;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await readDb();
  const wanted = username.trim();
  return db.users.find((u) => u.username === wanted) ?? null;
}

/** اعتبارسنجی نام کاربری: حداقل ۳ نویسه انگلیسی/عدد/نقطه/خط تیره/زیرخط */
function assertUsername(username: string): string {
  const wanted = username.trim();
  if (wanted.length < 3) {
    throw new Error("نام کاربری باید حداقل ۳ نویسه باشد.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(wanted)) {
    throw new Error(
      "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد.",
    );
  }
  return wanted;
}

/**
 * ثبت‌نام خودکار کاربر جدید (ثبت‌نام از صفحه عمومی): نقش عضو، حساب پیش‌فرض
 * غیرفعال تا ادمین فعالش کند و ورود با رمز مجاز. برگشتن با پیام خطای واضح
 * در صورت تکراری بودن نام کاربری یا نامعتبر بودن ورودی‌ها.
 */
export async function registerUser(input: {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
}): Promise<User> {
  const username = assertUsername(input.username);
  assertNewPassword(input.password);
  const db = await readDb();
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("این نام کاربری قبلاً ثبت شده است.");
  }
  const { hash, salt } = hashPassword(input.password);
  const now = new Date().toISOString();
  const user: User = {
    id: bankUid(),
    username,
    passwordHash: hash,
    salt,
    role: "member",
    fullName: input.fullName?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    memberId: null,
    active: false,
    passwordLoginEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

/** رمز موقت امن ۱۲ نویسه‌ای بدون نویسه‌های گیج‌کننده (0/O/1/l) برای ریست توسط ادمین */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ---------- مدیریت کاربران (فقط ادمین) ----------

export type UserPatch = {
  fullName?: string;
  phone?: string;
  role?: UserRole;
  active?: boolean;
  /** روشن/خاموش کردن «ورود با رمز عبور» کاربر توسط ادمین */
  passwordLoginEnabled?: boolean;
  memberId?: string | null;
  password?: string;
};

function assertRole(role: unknown): UserRole {
  if (role === "admin" || role === "member") return role;
  throw new Error("نقش کاربر فقط می‌تواند admin یا member باشد.");
}

function assertMemberExists(bank: BankDatabase, memberId: string | null | undefined) {
  if (memberId === null || memberId === undefined || memberId === "") return null;
  const member = bank.members.find((m) => m.id === memberId);
  if (!member) {
    throw new Error("عضو بانک انتخاب‌شده پیدا نشد.");
  }
  return member.id;
}

function assertNewPassword(password: string): string {
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("رمز عبور باید حداقل ۶ نویسه باشد.");
  }
  return password;
}

export async function listUsers(): Promise<User[]> {
  const db = await readDb();
  return db.users;
}

export async function createUser(input: {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  role?: unknown;
  memberId?: string | null;
}): Promise<User> {
  const username = assertUsername(input.username);
  assertNewPassword(input.password);
  const role = assertRole(input.role);
  const db = await readDb();
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("این نام کاربری قبلاً ثبت شده است.");
  }
  const memberId = assertMemberExists(db.bank, input.memberId);
  const { hash, salt } = hashPassword(input.password);
  const now = new Date().toISOString();
  const user: User = {
    id: bankUid(),
    username,
    passwordHash: hash,
    salt,
    role,
    fullName: input.fullName?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    memberId: role === "member" ? memberId : null,
    active: true,
    passwordLoginEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

/** تعداد ادمین‌های فعال فعلی — برای جلوگیری از قفل شدن سیستم */
function countActiveAdmins(db: Database): number {
  return db.users.filter((u) => u.role === "admin" && u.active).length;
}

/**
 * ویرایش کاربر توسط ادمین. callerId برای جلوگیری از اینکه ادمین حساب خودش را
 * غیرفعال کند یا «ورود با رمز» خودش را ببندد؛ حداقل یک ادمین فعال همیشه می‌ماند.
 */
export async function updateUser(
  id: string,
  patch: UserPatch,
  callerId?: string,
): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  if (callerId && callerId === id) {
    if (patch.active === false) {
      throw new Error("نمی‌توانید حساب خودتان را غیرفعال کنید.");
    }
    if (patch.passwordLoginEnabled === false) {
      throw new Error("نمی‌توانید ورود با رمز عبور حساب خودتان را غیرفعال کنید.");
    }
  }
  const nextRole = patch.role !== undefined ? assertRole(patch.role) : user.role;
  const nextActive = patch.active !== undefined ? patch.active : user.active;
  if (
    user.role === "admin" &&
    user.active &&
    (nextRole !== "admin" || !nextActive) &&
    countActiveAdmins(db) <= 1
  ) {
    throw new Error("آخرین ادمین فعال را نمی‌توان غیرفعال یا عضو کرد؛ ابتدا یک ادمین دیگر بسازید.");
  }
  const memberId =
    patch.memberId !== undefined ? assertMemberExists(db.bank, patch.memberId) : user.memberId;
  if (patch.password !== undefined) {
    assertNewPassword(patch.password);
    const { hash, salt } = hashPassword(patch.password);
    user.passwordHash = hash;
    user.salt = salt;
  }
  if (patch.fullName !== undefined) user.fullName = patch.fullName.trim();
  if (patch.phone !== undefined) user.phone = patch.phone.trim();
  user.role = nextRole;
  user.active = nextActive;
  user.memberId = user.role === "member" ? memberId : null;
  if (patch.passwordLoginEnabled !== undefined) {
    user.passwordLoginEnabled = patch.passwordLoginEnabled;
  }
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return user;
}

/**
 * فعال/غیرفعال کردن حساب کاربر توسط ادمین. ادمین نمی‌تواند خودش را غیرفعال کند
 * و آخرین ادمین فعال هم همیشه باقی می‌ماند. با غیرفعال شدن، همه نشست‌های فعال
 * کاربر بلافاصله باطل می‌شوند (getSessionUser وضعیت لحظه‌ای کاربر را می‌بیند).
 */
export async function setUserActive(
  id: string,
  active: boolean,
  callerId?: string,
): Promise<User> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new Error("کاربر پیدا نشد.");
  if (!active) {
    if (callerId && callerId === id) {
      throw new Error("نمی‌توانید حساب خودتان را غیرفعال کنید.");
    }
    if (
      user.role === "admin" &&
      user.active &&
      countActiveAdmins(db) <= 1
    ) {
      throw new Error("آخرین ادمین فعال را نمی‌توان غیرفعال کرد؛ ابتدا یک ادمین دیگر بسازید.");
    }
  }
  if (user.active !== active) {
    user.active = active;
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
  }
  return user;
}

/**
 * فعال/غیرفعال کردن «ورود با رمز عبور» کاربر توسط ادمین. ادمین نمی‌تواند
 * ورود با رمز خودش را ببندد. با بستن، ورود با رمز فوراً رد می‌شود و نشست‌های
 * فعال کاربر هم بلافاصله باطل می‌شوند (getSessionUser وضعیت لحظه‌ای را می‌بیند).
 */
export async function setPasswordLogin(
  id: string,
  enabled: boolean,
  callerId?: string,
): Promise<User> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new Error("کاربر پیدا نشد.");
  if (!enabled && callerId && callerId === id) {
    throw new Error("نمی‌توانید ورود با رمز عبور حساب خودتان را غیرفعال کنید.");
  }
  if (user.passwordLoginEnabled !== enabled) {
    user.passwordLoginEnabled = enabled;
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
  }
  return user;
}

/**
 * ریست رمز عبور کاربر توسط ادمین: رمز جدید داده‌شده یا در نبود آن رمز موقت
 * تولیدی. تغییر رمز کلید امضای نشست را عوض می‌کند، پس همه نشست‌های قبلی کاربر
 * باطل می‌شوند. اگر رمز موقت تولید شود در خروجی برمی‌گردد تا ادمین به کاربر بدهد.
 */
export async function adminResetPassword(
  id: string,
  newPassword?: string,
): Promise<{ user: User; generated: boolean; tempPassword: string | null }> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new Error("کاربر پیدا نشد.");
  const generated = newPassword === undefined || newPassword === "";
  const password = generated ? generateTempPassword() : assertNewPassword(newPassword);
  const { hash, salt } = hashPassword(password);
  user.passwordHash = hash;
  user.salt = salt;
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return { user, generated, tempPassword: generated ? password : null };
}

export async function deleteUser(id: string): Promise<User | null> {
  const db = await readDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const [removed] = db.users.splice(index, 1);
  if (removed.role === "admin" && removed.active && countActiveAdmins(db) < 1) {
    // برگرداندن تغییر برای جلوگیری از قفل شدن سیستم
    db.users.splice(index, 0, removed);
    throw new Error("حذف آخرین ادمین مجاز نیست؛ ابتدا یک ادمین دیگر بسازید.");
  }
  db.sessions = db.sessions.filter((s) => s.userId !== id);
  await writeDb(db);
  return removed;
}

// ---------- درخواست‌های عضو (پرداخت با رسید و درخواست تسهیلات) ----------

export type RequestStatus = "pending" | "approved" | "rejected";

export type PaymentRequest = {
  id: string;
  /** share = پرداخت سهام، installment = پرداخت قسط وام */
  kind: "share" | "installment";
  memberId: string;
  userId: string;
  username: string;
  amount: number;
  /**
   * عکس رسید به‌صورت data URL — اختیاری؛ هر فرمت عکس (image/*) پذیرفته می‌شود.
   * اگر عکسی نباشد، توضیح متنی در note الزامی است.
   */
  receipt: string;
  note: string;
  status: RequestStatus;
  loanId?: string;
  installmentNumber?: number;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type LoanRequest = {
  id: string;
  memberId: string;
  userId: string;
  username: string;
  amount: number;
  months: number;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

function assertReceipt(receipt: string) {
  // عکس رسید اختیاری است؛ درخواست فقط با توضیح متنی هم قابل ثبت است.
  if (!receipt) return;
  // هر فرمت عکس (image/*) پذیرفته می‌شود — فقط صحت data URL و سقف حجم چک می‌شود.
  if (!receipt.startsWith("data:image/")) {
    throw new Error("فرمت عکس رسید معتبر نیست؛ فقط فایل عکس قابل بارگذاری است.");
  }
  if (receipt.length > RECEIPT_MAX_CHARS) {
    throw new Error("حجم عکس رسید باید کمتر از حدود ۲ مگابایت باشد.");
  }
}

async function assertMemberAccount(user: User): Promise<string> {
  const db = await readDb();
  const memberId = user.memberId;
  if (!memberId || !db.bank.members.some((m) => m.id === memberId)) {
    throw new Error("حساب شما به عضوی از بانک متصل نیست؛ با مدیر تماس بگیرید.");
  }
  return memberId;
}

export async function createPaymentRequest(input: {
  kind: "share" | "installment";
  user: User;
  amount: number;
  receipt: string;
  note?: string;
  loanId?: string;
  installmentNumber?: number;
}): Promise<PaymentRequest> {
  const memberId = await assertMemberAccount(input.user);
  assertReceipt(input.receipt);
  // بدون عکس رسید، حداقل یک توضیح متنی الزامی است تا مدیر بتواند درخواست را بررسی کند.
  if (!input.receipt && !(input.note ?? "").trim()) {
    throw new Error("اگر عکس رسید ندارید، نوشتن توضیح پرداخت در یادداشت الزامی است.");
  }
  if (!(Number(input.amount) > 0)) {
    throw new Error("مبلغ پرداخت باید عددی بزرگ‌تر از صفر باشد.");
  }
  const db = await readDb();
  if (input.kind === "installment") {
    const loan = input.loanId ? db.bank.loans.find((l) => l.id === input.loanId) : undefined;
    if (!loan || loan.memberId !== memberId) {
      throw new Error("وام مورد نظر پیدا نشد.");
    }
    // برای هر قسط فقط یک درخواست معلق؛ جلوگیری از تأیید دوبارهٔ همان قسط
    const dupPending = db.paymentRequests.some(
      (r) =>
        r.kind === "installment" &&
        r.status === "pending" &&
        r.loanId === input.loanId &&
        r.installmentNumber === input.installmentNumber,
    );
    if (dupPending) {
      throw new Error("برای این قسط یک درخواست پرداخت در انتظار تأیید وجود دارد.");
    }
  }
  const request: PaymentRequest = {
    id: bankUid(),
    kind: input.kind,
    memberId,
    userId: input.user.id,
    username: input.user.username,
    amount: input.amount,
    receipt: input.receipt,
    note: input.note?.trim() ?? "",
    status: "pending",
    loanId: input.loanId,
    installmentNumber: input.installmentNumber,
    createdAt: new Date().toISOString(),
  };
  db.paymentRequests.unshift(request);
  await writeDb(db);
  return request;
}

export async function createLoanRequest(input: {
  user: User;
  amount: number;
  months: number;
  reason: string;
}): Promise<LoanRequest> {
  const memberId = await assertMemberAccount(input.user);
  if (!(Number(input.amount) > 0)) {
    throw new Error("مبلغ درخواستی باید عددی بزرگ‌تر از صفر باشد.");
  }
  const months = Math.floor(Number(input.months));
  if (!Number.isFinite(months) || months < 1 || months > 60) {
    throw new Error("مدت بازپرداخت باید بین ۱ تا ۶۰ ماه باشد.");
  }
  const db = await readDb();
  const request: LoanRequest = {
    id: bankUid(),
    memberId,
    userId: input.user.id,
    username: input.user.username,
    amount: input.amount,
    months,
    reason: input.reason.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.loanRequests.unshift(request);
  await writeDb(db);
  return request;
}

export async function listUserRequests(userId: string): Promise<{
  paymentRequests: PaymentRequest[];
  loanRequests: LoanRequest[];
}> {
  const db = await readDb();
  return {
    paymentRequests: db.paymentRequests.filter((r) => r.userId === userId),
    loanRequests: db.loanRequests.filter((r) => r.userId === userId),
  };
}

export async function listAllRequests(): Promise<{
  paymentRequests: PaymentRequest[];
  loanRequests: LoanRequest[];
}> {
  const db = await readDb();
  return { paymentRequests: db.paymentRequests, loanRequests: db.loanRequests };
}

// ---------- درخواست‌های خوانده‌نشده (اعلان ادمین) ----------
//
// «خوانده‌نشده» بدون تغییر schema دیتابیس پیاده‌سازی شده است: یک ردیف نشانگر
// (cursor) با id ثابت در bank_audit نگه داشته می‌شود که تاریخ آخرین بازدید
// ادمین از صفحه درخواست‌ها را دارد. هر درخواست pending که createdAt جدیدتری
// از آن نشانگر داشته باشد «خوانده‌نشده» است. این روش هم با fallback فایل و
// هم با Supabase (بدون مایگریشن) کار می‌کند. تنها نقطه ضعف: اگر بین دو بازدید
// ادمین بیش از سقف ۱۰۰۰ رکورد audit جدید ثبت شود، نشانگر پاک می‌شود و همه
// درخواست‌های pending یک‌بار «خوانده‌نشده» دیده می‌شوند (بی‌ضرر برای داده).

/** id ثابت ردیف نشانگر آخرین بازدید ادمین از درخواست‌ها */
export const REQUESTS_READ_CURSOR_ID = "admin-requests-read-cursor";

const REQUESTS_READ_DETAIL = "مشاهده درخواست‌های اعضا توسط مدیر";

function readCursorAt(bank: BankDatabase): string {
  return bank.auditLog.find((a) => a.id === REQUESTS_READ_CURSOR_ID)?.at ?? "";
}

/** آخرین زمانی که ادمین صفحه درخواست‌ها را دیده است ("" یعنی هرگز) */
export async function getRequestsReadCursor(): Promise<string> {
  const db = await readDb();
  return readCursorAt(db.bank);
}

/**
 * ثبت بازدید ادمین از صفحه درخواست‌ها — همه درخواست‌های pending تا همین لحظه
 * «خوانده‌شده» می‌شوند (نشانگر به زمان حال جلو می‌رود) و زمان جدید برمی‌گردد.
 */
export async function markRequestsRead(): Promise<string> {
  const db = await readDb();
  const at = new Date().toISOString();
  const existing = db.bank.auditLog.find((a) => a.id === REQUESTS_READ_CURSOR_ID);
  if (existing) {
    existing.at = at;
    existing.detail = REQUESTS_READ_DETAIL;
  } else {
    db.bank.auditLog.unshift({
      id: REQUESTS_READ_CURSOR_ID,
      at,
      action: "read",
      kind: "درخواست‌ها",
      recordId: "all",
      detail: REQUESTS_READ_DETAIL,
    });
  }
  await writeDb(db);
  return at;
}

export type UnreadRequests = {
  count: number;
  paymentCount: number;
  loanCount: number;
  lastReadAt: string;
  paymentRequests: PaymentRequest[];
  loanRequests: LoanRequest[];
};

/** درخواست‌های خوانده‌نشده = pending با createdAt جدیدتر از آخرین بازدید ادمین */
export async function getUnreadRequests(): Promise<UnreadRequests> {
  const db = await readDb();
  const lastReadAt = readCursorAt(db.bank);
  const isNew = (r: { status: RequestStatus; createdAt: string }) =>
    r.status === "pending" && (!lastReadAt || r.createdAt > lastReadAt);
  const paymentRequests = db.paymentRequests.filter(isNew);
  const loanRequests = db.loanRequests.filter(isNew);
  return {
    count: paymentRequests.length + loanRequests.length,
    paymentCount: paymentRequests.length,
    loanCount: loanRequests.length,
    lastReadAt,
    paymentRequests,
    loanRequests,
  };
}

/** بررسی درخواست پرداخت توسط ادمین؛ تأیید = ثبت رکورد واقعی در بانک (یک write) */
export async function reviewPaymentRequest(
  id: string,
  action: "approve" | "reject",
  reviewNote?: string,
): Promise<PaymentRequest> {
  const db = await readDb();
  const request = db.paymentRequests.find((r) => r.id === id);
  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }
  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }
  const now = new Date().toISOString();
  if (action === "approve") {
    if (request.kind === "share") {
      const member = db.bank.members.find((m) => m.id === request.memberId);
      const deposit: BankDeposit = {
        id: bankUid(),
        memberId: member ? member.id : null,
        memberName: member ? member.name : "واریزی متفرقه",
        type: "share",
        title: defaultDepositTitle(db.bank, "share"),
        amount: request.amount,
        periodKey: parseSharePeriod("", new Date()),
        createdAt: now,
      };
      db.bank.deposits.unshift(deposit);
      recalcMemberTotals(db.bank);
      addAudit(
        db.bank,
        "ثبت",
        "واریزی",
        deposit.id,
        `واریزی سهام ${faAmount(request.amount)} تومانی از پرداخت تأییدشده کاربر «${request.username}» ثبت شد.`,
      );
    } else {
      const loan = request.loanId ? db.bank.loans.find((l) => l.id === request.loanId) : undefined;
      if (!loan) {
        throw new Error("وام مربوط به این قسط پیدا نشد.");
      }
      const payment: BankLoanPayment = {
        id: bankUid(),
        amount: request.amount,
        paidAt: now,
        note: `پرداخت قسط ${request.installmentNumber ?? ""} توسط کاربر «${request.username}»`.trim(),
      };
      loan.payments.push(payment);
      const remaining = loanRemaining(loan);
      if (remaining === 0 && loan.status === "active") {
        loan.status = "paid";
      }
      addAudit(
        db.bank,
        "ثبت",
        "پرداخت",
        payment.id,
        `پرداخت قسط ${faAmount(request.amount)} تومانی وام عضو «${loan.memberName}» از پرداخت تأییدشده کاربر ثبت شد (مانده ${faAmount(remaining)} تومان).`,
      );
    }
  }
  request.status = action === "approve" ? "approved" : "rejected";
  request.reviewedAt = now;
  request.reviewNote = reviewNote?.trim() ?? "";
  await writeDb(db);
  return request;
}

/** تاریخ شمسی حدود یک ماه بعد از امروز (روز بیشتر از ۲۹/۳۰/۳۱ هر ماه شمسی بسته می‌شود) */
function nextMonthJalaliDay(now: Date = new Date()): string {
  const p = jalaliParts(now);
  let year = p.year;
  let month = p.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 29;
  const day = Math.min(p.day, maxDay);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** ویرایش درخواست تسهیلات معلق توسط ادمین (مبلغ / مدت / دلیل) */
export async function updateLoanRequest(
  id: string,
  patch: { amount?: number; months?: number; reason?: string },
): Promise<LoanRequest> {
  const db = await readDb();
  const request = db.loanRequests.find((r) => r.id === id);
  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }
  if (request.status !== "pending") {
    throw new Error("فقط درخواست‌های در انتظار تأیید قابل ویرایش هستند.");
  }
  if (patch.amount !== undefined) {
    const amount = Number(patch.amount);
    if (!(amount > 0)) {
      throw new Error("مبلغ درخواستی باید عددی بزرگ‌تر از صفر باشد.");
    }
    request.amount = amount;
  }
  if (patch.months !== undefined) {
    const months = Math.floor(Number(patch.months));
    if (!Number.isFinite(months) || months < 1 || months > 60) {
      throw new Error("مدت بازپرداخت باید بین ۱ تا ۶۰ ماه باشد.");
    }
    request.months = months;
  }
  if (patch.reason !== undefined) {
    request.reason = patch.reason.trim().slice(0, 1000);
  }
  await writeDb(db);
  return request;
}

/**
 * بررسی درخواست تسهیلات توسط ادمین؛ تأیید نهایی = ثبت خودکار وام واقعی در بانک
 * (یک write) تا وام بلافاصله در پنل ادمین (تب وام‌ها) و پنل عضو دیده شود.
 * سود (تومان)، حالت سود (اضافه به انتها / کسر از ابتدا) و تاریخ شمسی اولین قسط
 * در گزینه‌های تأیید قابل تنظیم است؛ اگر داده نشود سود صفر با حالت «اضافه به
 * انتها» و اولین قسط حدود یک ماه بعد ثبت می‌شود. جدول اقساط خودکار است و ادمین
 * می‌تواند بعداً از تب وام‌ها ویرایشش کند.
 */
export type LoanApproveOptions = {
  interestAmount?: number;
  interestMode?: BankLoan["interestMode"];
  firstDue?: string;
};

export async function reviewLoanRequest(
  id: string,
  action: "approve" | "reject",
  reviewNote?: string,
  options?: LoanApproveOptions,
): Promise<LoanRequest> {
  const db = await readDb();
  const request = db.loanRequests.find((r) => r.id === id);
  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }
  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }
  const now = new Date().toISOString();
  if (action === "approve") {
    const member = db.bank.members.find((m) => m.id === request.memberId);
    if (!member) {
      throw new Error(
        "عضو این درخواست در بانک پیدا نشد؛ ابتدا عضو را بازسازی کنید یا درخواست را رد کنید.",
      );
    }
    let interestAmount = 0;
    if (options?.interestAmount !== undefined && options.interestAmount !== null) {
      interestAmount = Math.floor(Number(options.interestAmount));
      if (!Number.isFinite(interestAmount) || interestAmount < 0) {
        throw new Error("سود باید عددی بزرگ‌تر یا مساوی صفر باشد.");
      }
    }
    let interestMode: BankLoan["interestMode"] = "end";
    if (options?.interestMode !== undefined && options.interestMode !== null) {
      if (options.interestMode !== "beginning" && options.interestMode !== "end") {
        throw new Error("حالت سود باید «کسر از ابتدا» یا «اضافه به انتها» باشد.");
      }
      interestMode = options.interestMode;
    }
    const firstDueRaw = typeof options?.firstDue === "string" ? options.firstDue.trim() : "";
    let firstDue = nextMonthJalaliDay();
    if (firstDueRaw) {
      const parsed = jalaliToDate(firstDueRaw);
      if (!parsed) {
        throw new Error("تاریخ اولین قسط را شمسی و به شکل ۱۴۰۵/۰۸/۲۷ وارد کنید.");
      }
      const p = jalaliParts(parsed);
      firstDue = `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
    }
    const principal = request.amount;
    const installmentCount = request.months;
    const { totalAmount, disbursedAmount } = loanTotals(principal, interestAmount, interestMode);
    const schedule = makeSchedule({
      total: totalAmount,
      months: installmentCount,
      firstDue,
      mode: "auto",
    });
    const interestLabel =
      interestAmount > 0
        ? ` با سود ${faAmount(interestAmount)} تومان${interestMode === "beginning" ? " (کسر از ابتدا)" : ""}`
        : "";
    const loan: BankLoan = {
      id: bankUid(),
      memberId: member.id,
      memberName: member.name,
      principal,
      interestMode,
      interestAmount,
      totalAmount,
      disbursedAmount,
      installmentCount,
      schedule,
      payments: [],
      status: "active",
      note: `ثبت خودکار از تأیید نهایی درخواست تسهیلات کاربر «${request.username}»${interestLabel}${
        reviewNote?.trim() ? ` — ${reviewNote.trim()}` : ""
      }`,
      createdAt: now,
    };
    db.bank.loans.unshift(loan);
    addAudit(
      db.bank,
      "ثبت",
      "وام",
      loan.id,
      `وام ${faAmount(principal)} تومانی برای عضو «${member.name}» با ${installmentCount.toLocaleString("fa-IR")} قسط${
        interestAmount > 0
          ? ` و سود ${faAmount(interestAmount)} تومان${interestMode === "beginning" ? " (کسر از ابتدا)" : ""}`
          : ""
      } و کل بازپرداخت ${faAmount(totalAmount)} تومان، از تأیید نهایی درخواست تسهیلات به‌صورت خودکار ثبت شد.`,
    );
    addAudit(
      db.bank,
      "تأیید",
      "درخواست",
      request.id,
      `درخواست تسهیلات کاربر «${request.username}» تأیید نهایی شد و وام آن در بانک ثبت گردید.`,
    );
  }
  request.status = action === "approve" ? "approved" : "rejected";
  request.reviewedAt = now;
  request.reviewNote = reviewNote?.trim() ?? "";
  await writeDb(db);
  return request;
}

/** تغییر رمز توسط خود کاربر (بعد از تأیید رمز فعلی در route) */
export async function updateUserPassword(id: string, newPassword: string): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  await writeDb(db);
  return user;
}
