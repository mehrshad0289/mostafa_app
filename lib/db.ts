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
};

const SOURCE_FILE = path.join(process.cwd(), "data", "db.json");
const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "mostafa-app-db.json")
  : SOURCE_FILE;

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      items: (parsed.items ?? seed.items).map((item) => ({
        ...item,
        kind: normalizeKind(item.kind),
      })),
      bank: normalizeBank(parsed.bank),
    };
  } catch {
    return {
      items: seed.items.map((item) => ({
        ...item,
        kind: normalizeKind((item as { kind?: unknown }).kind),
      })),
      bank: normalizeBank((seed as Partial<Database>).bank),
    };
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
