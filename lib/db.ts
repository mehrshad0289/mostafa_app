import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import seed from "@/data/db.json";
import { bankUid, jalaliParts, loanRemaining, loanTotals, makeSchedule, parseSharePeriod } from "./bank";

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

// ---------- بانک حقیقی: مدل داده مطابق docs/BANK_SPEC.md ----------

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

function normalizeDb(parsed: Partial<Database>): Database {
  const db: Database = {
    items: (parsed.items ?? seed.items).map((item) => ({
      ...item,
      kind: normalizeKind(item.kind),
    })),
    bank: normalizeBank(parsed.bank),
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    paymentRequests: Array.isArray(parsed.paymentRequests) ? parsed.paymentRequests : [],
    loanRequests: Array.isArray(parsed.loanRequests) ? parsed.loanRequests : [],
  };
  ensureDefaultAdmin(db);
  return db;
}

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return normalizeDb(JSON.parse(raw) as Partial<Database>);
  } catch {
    return normalizeDb(seed as Partial<Database>);
  }
}

async function writeDb(db: Database) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
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

// ---------- بانک حقیقی: ذخیره‌سازی و عملیات اعضا ----------

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

// ---------- بانک حقیقی: عملیات واریزی‌ها ----------

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

// ---------- بانک حقیقی: عملیات وام‌ها و اقساط ----------

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

// ---------- بانک حقیقی: تسویه اعضا و تنظیمات ----------

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
  /** اتصال کاربر به عضو صندوق در بخش بانک حقیقی (برای فیلتر داده عضو عادی) */
  memberId: string | null;
  active: boolean;
  createdAt: string;
};

export type PublicUser = Omit<User, "passwordHash" | "salt">;

export type Session = {
  id: string;
  userId: string;
  expiresAt: string;
};

const DEFAULT_ADMIN_ID = "user-admin-default";
const DEFAULT_ADMIN_USERNAME = "admin";
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
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash: scryptSync(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_SALT, 64).toString("hex"),
    salt: DEFAULT_ADMIN_SALT,
    role: "admin",
    fullName: "مدیر سیستم",
    phone: "",
    memberId: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
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

/** ساخت نشست جدید؛ نشست‌های منقضی در همان لحظه پاک می‌شوند */
export async function createSession(userId: string, ttlDays = SESSION_TTL_DAYS): Promise<Session> {
  const db = await readDb();
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  const session: Session = {
    id: randomBytes(24).toString("hex"),
    userId,
    expiresAt: new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
  };
  db.sessions.push(session);
  await writeDb(db);
  return session;
}

/** حذف نشست با شناسه کوکی (برای خروج) */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = await readDb();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.id !== sessionId);
  if (db.sessions.length === before) return false;
  await writeDb(db);
  return true;
}

/** خواندن کاربر معتبر از نشست؛ کاربر غیرفعال یا نشست منقضی = null */
export async function getSessionUser(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  const db = await readDb();
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user || !user.active) return null;
  return user;
}

/** یافتن کاربر با نام کاربری (برای ورود) */
export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await readDb();
  const wanted = username.trim();
  return db.users.find((u) => u.username === wanted) ?? null;
}

// ---------- مدیریت کاربران (فقط ادمین) ----------

export type UserPatch = {
  fullName?: string;
  phone?: string;
  role?: UserRole;
  active?: boolean;
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
    throw new Error("عضو صندوق انتخاب‌شده پیدا نشد.");
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
  const username = input.username.trim();
  if (username.length < 3) {
    throw new Error("نام کاربری باید حداقل ۳ نویسه باشد.");
  }
  assertNewPassword(input.password);
  const role = assertRole(input.role);
  const db = await readDb();
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("این نام کاربری قبلاً ثبت شده است.");
  }
  const memberId = assertMemberExists(db.bank, input.memberId);
  const { hash, salt } = hashPassword(input.password);
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
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

/** تعداد ادمین‌های فعال فعلی — برای جلوگیری از قفل شدن سیستم */
function countActiveAdmins(db: Database): number {
  return db.users.filter((u) => u.role === "admin" && u.active).length;
}

export async function updateUser(id: string, patch: UserPatch): Promise<User | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
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
  await writeDb(db);
  return user;
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
  /** عکس رسید به‌صورت data URL (محدود حجم در API) */
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

export const RECEIPT_MAX_CHARS = 1_600_000; // حدود ۱٫۲ مگابایت داده باینری

function assertReceipt(receipt: string) {
  if (!receipt.startsWith("data:image/")) {
    throw new Error("عکس رسید الزامی است.");
  }
  if (receipt.length > RECEIPT_MAX_CHARS) {
    throw new Error("حجم عکس رسید باید کمتر از ۱٫۵ مگابایت باشد.");
  }
}

async function assertMemberAccount(user: User): Promise<string> {
  const db = await readDb();
  const memberId = user.memberId;
  if (!memberId || !db.bank.members.some((m) => m.id === memberId)) {
    throw new Error("حساب شما به عضوی از صندوق متصل نیست؛ با مدیر تماس بگیرید.");
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

/** بررسی درخواست تسهیلات توسط ادمین؛ تأیید فقط وضعیت را ثبت می‌کند (وام واقعی از تب وام‌ها ثبت می‌شود) */
export async function reviewLoanRequest(
  id: string,
  action: "approve" | "reject",
  reviewNote?: string,
): Promise<LoanRequest> {
  const db = await readDb();
  const request = db.loanRequests.find((r) => r.id === id);
  if (!request) {
    throw new Error("درخواست پیدا نشد.");
  }
  if (request.status !== "pending") {
    throw new Error("این درخواست قبلاً بررسی شده است.");
  }
  request.status = action === "approve" ? "approved" : "rejected";
  request.reviewedAt = new Date().toISOString();
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
