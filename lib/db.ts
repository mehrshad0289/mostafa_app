import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import seed from "@/data/db.json";
import { bankUid } from "./bank";

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
