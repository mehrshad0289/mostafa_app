"use client";

import { useMemo, useState } from "react";
import {
  monthKey,
  normalizeSearchText,
  parseAmount,
  parseSharePeriod,
} from "@/lib/bank";
import { isWithdrawType } from "@/lib/deposit-types";
import type { BankDeposit, BankDepositType, BankLoan, BankLoanPayment, BankMember, BankSettings } from "@/lib/db";
import JalaliCalendar from "./JalaliCalendar";
import { useHydrated } from "./useHydrated";
import { downloadCsv } from "./csv";

type DepositsTabProps = {
  members: BankMember[];
  deposits: BankDeposit[];
  /** وام‌ها — برای نمایش پرداخت اقساط و تسهیلات پرداختی در فهرست تراکنش‌ها */
  loans: BankLoan[];
  settings: BankSettings | null;
  onRefresh: () => void;
};

/**
 * تب «تراکنش‌ها» (جلسه ۲۶ — نام قبلی: واریزی‌ها): همه تراکنش‌های بانک در یک
 * فهرست با زیرمجموعه واریز/برداشت — واریز سهام بانک، سود بانک، واریز متفرقه،
 * پرداخت اقساط تسهیلات، تسهیلات پرداختی و برداشت متفرقه.
 * جلسه ۵۱: عنوان هر ردیف فقط «واریز» و «برداشت» است (به درخواست کاربر) و
 * نوع/توضیحات در بج کوچک و مودال جزئیاتِ بعد از لمس دیده می‌شود.
 * جلسه ۵۸ (به درخواست کاربر): دکمه و فرم «ثبت واریزی» به «ثبت تراکنش» تغییر
 * کرد و حالا برداشت متفرقه هم ثبت می‌شود؛ انتخاب عضو «یک عضو» یا «همه اعضا»
 * (برای تقسیم سود و واریزی متفرقهٔ گروهی) با دو حالت مبلغ «برای هر عضو» یا
 * «مبلغ کل تقسیم مساوی». فقط رکوردهای این فرم (واریزی/برداشت متفرقه) قابل
 * حذف‌اند؛ اقساط/برداشت تسهیلات از تب وام‌ها مدیریت می‌شوند.
 */

/** جلسه ۵۹ — برچسب فارسی همهٔ انواع تراکنش؛ در فرم و بج نوعِ فهرست استفاده می‌شود.
 *  هر دو گروه واریز و برداشت همان دسته‌ها را دارند (به درخواست کاربر):
 *  واریز: پرداخت قسط، پرداخت سهام، سود بانک، متفرقه —
 *  برداشت: برداشت قسط، برداشت سهام، برداشت سود بانک، برداشت متفرقه. */
const TYPE_LABELS: Record<BankDepositType, string> = {
  share: "پرداخت سهام",
  installment: "پرداخت قسط",
  loan_interest: "سود بانک",
  profit: "سود بانک",
  misc: "متفرقه",
  withdraw_installment: "برداشت قسط",
  withdraw_share: "برداشت سهام",
  withdraw_profit: "برداشت سود بانک",
  withdraw_misc: "برداشت متفرقه",
};

/** انواع مجاز فرم در گروه واریز — loan_interest فقط خودکار ساخته می‌شود و در فرم نیست */
const FORM_DEPOSIT_TYPES: BankDepositType[] = ["installment", "share", "profit", "misc"];

/** انواع مجاز فرم در گروه برداشت — همان دسته‌های واریز (به درخواست کاربر) */
const FORM_WITHDRAW_TYPES: BankDepositType[] = [
  "withdraw_installment",
  "withdraw_share",
  "withdraw_profit",
  "withdraw_misc",
];

/** انواعی که بدون عضو معنا ندارند — در فرم و سرور چک می‌شود */
const MEMBER_REQUIRED_TYPES: BankDepositType[] = [
  "share",
  "installment",
  "withdraw_share",
  "withdraw_installment",
];

const GROUP_FILTERS: { key: TxGroupFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "deposit", label: "واریز" },
  { key: "withdraw", label: "برداشت" },
];

type TxGroupFilter = "all" | "deposit" | "withdraw";

/** یک ردیف تراکنش یک‌‌‌‌‌پارچه (واریزی یا قسط یا برداشت) */
type TxRow = {
  id: string;
  group: "deposit" | "withdraw";
  kindLabel: string;
  /** عنوان ثبت‌شده واریزی — برای قسط/برداشت خالی */
  title: string;
  member: string;
  amount: number;
  at: string;
  periodKey: string;
  /** فقط واریزی‌ها قابل حذف‌اند */
  deposit: BankDeposit | null;
  /** جلسه ۵۰ — رکورد مبدأ برای مودال جزئیات لمس تراکنش */
  loan: BankLoan | null;
  payment: BankLoanPayment | null;
  /** شماره پرداخت در فهرست پرداخت‌های وام (از ۱) */
  paymentIndex: number;
};

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

function toMoney(value: number): string {
  return `${faNum(Math.round(value))} تومان`;
}

const jalaliDateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
});

function faDate(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return jalaliDateFmt.format(date);
}

function faTime(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** برچسب فارسی وضعیت وام برای جزئیات برداشت */
function loanStatusLabel(status: BankLoan["status"]): string {
  if (status === "paid") return "تسویه‌شده";
  if (status === "cancelled") return "لغو‌شده";
  return "در جریان";
}

/** جلسه ۵۱ — شرح ساده هر تراکنش برای مودال جزئیات (توضیحات بعد از لمس) */
function txDescription(r: TxRow): string {
  if (r.payment) return "واریز بابت پرداخت قسط تسهیلات توسط عضو.";
  if (r.loan && r.group === "withdraw") return "برداشت مبلغ تسهیلات پرداخت‌شده به عضو از موجودی بانک.";
  if (r.deposit && isWithdrawType(r.deposit.type)) {
    return r.member
      ? `${r.kindLabel} از حساب عضو توسط مدیر ثبت شد.`
      : `${r.kindLabel} از موجودی بانک (بدون عضو) توسط مدیر ثبت شد.`;
  }
  if (r.deposit?.type === "installment") {
    return r.member
      ? "پرداخت قسط عضو توسط مدیر در بانک ثبت شد."
      : "پرداخت قسط توسط مدیر در بانک ثبت شد.";
  }
  return "واریز به حساب عضو در بانک ثبت شد.";
}

type DetailLine = { label: string; value: string; tone?: "green" | "red" };

/** جلسه ۵۰ — خط‌های مودال جزئیات کامل هر تراکنش */
function detailLines(r: TxRow): DetailLine[] {
  const lines: DetailLine[] = [];
  lines.push({
    label: "گروه",
    value: r.group === "deposit" ? "واریز" : "برداشت",
    tone: r.group === "deposit" ? "green" : "red",
  });
  lines.push({ label: "نوع تراکنش", value: r.kindLabel });
  lines.push({ label: "شرح", value: txDescription(r) });
  if (r.title && r.title !== r.kindLabel) {
    lines.push({ label: "عنوان ثبت‌شده", value: r.title });
  }
  if (r.member) lines.push({ label: "عضو", value: r.member });
  lines.push({ label: "مبلغ", value: toMoney(r.amount), tone: r.group === "deposit" ? "green" : "red" });
  lines.push({
    label: "اثر روی موجودی",
    value: r.group === "deposit" ? "افزایش موجودی بانک" : "کاهش موجودی بانک",
    tone: r.group === "deposit" ? "green" : "red",
  });
  if (r.periodKey) lines.push({ label: "دوره", value: r.periodKey });
  const time = faTime(r.at);
  lines.push({ label: "تاریخ ثبت", value: `${faDate(r.at)}${time ? ` — ساعت ${time}` : ""}` });
  if (r.loan && r.group === "withdraw") {
    lines.push({ label: "اصل وام", value: toMoney(r.loan.principal) });
    lines.push({ label: "کل بازپرداخت", value: toMoney(r.loan.totalAmount) });
    lines.push({ label: "تعداد اقساط", value: `${faNum(r.loan.installmentCount)} قسط` });
    lines.push({ label: "وضعیت وام", value: loanStatusLabel(r.loan.status) });
    if (r.loan.note) lines.push({ label: "یادداشت وام", value: r.loan.note });
  }
  if (r.payment && r.loan) {
    const total = (r.loan.payments || []).length;
    lines.push({
      label: "شماره پرداخت",
      value: `پرداخت ${faNum(r.paymentIndex)} از ${faNum(total)}`,
    });
    if (r.payment.note) lines.push({ label: "توضیح پرداخت", value: r.payment.note });
  }
  return lines;
}

export default function DepositsTab({
  members,
  deposits,
  loans,
  settings,
  onRefresh,
}: DepositsTabProps) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<TxGroupFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  /** جلسه ۵۸ — فرم «ثبت تراکنش»: گروه (واریز/برداشت) + عضو (یکی/همه/بدون عضو)
   *  + نوع واریزی + حالت مبلغ گروهی. memberId = "all" یعنی همهٔ اعضا،
   *  "" یعنی بدون عضو (متفرقه)، وگرنه شناسهٔ عضو مشخص. */
  const [form, setForm] = useState({
    direction: "deposit" as "deposit" | "withdraw",
    memberId: "",
    type: "misc" as BankDepositType,
    splitMode: "perMember" as "perMember" | "total",
    title: "",
    amount: "",
    period: "",
  });
  const [dateIso, setDateIso] = useState("");
  const [deleting, setDeleting] = useState<BankDeposit | null>(null);
  const [dupPending, setDupPending] = useState<BankDeposit | null>(null);
  /** جلسه ۵۰ — تراکنش لمس‌شده؛ جزئیات کامل آن در مودال نمایش داده می‌شود */
  const [detailRow, setDetailRow] = useState<TxRow | null>(null);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const titles = settings?.depositTitles ?? [];

  /** دوره استاندارد سهام = پارس ورودی آزاد با مبنای تاریخ تقویم */
  const resolvedPeriod = useMemo(() => {
    if (!hydrated || form.direction !== "deposit" || form.type !== "share") return null;
    return parseSharePeriod(form.period, dateIso ? new Date(dateIso) : undefined);
  }, [hydrated, form.direction, form.type, form.period, dateIso]);

  /** جلسه ۵۸ — اعضای هدف فرم: همهٔ اعضا / یک عضو / بدون عضو */
  const targetMemberIds = useMemo(() => {
    if (form.memberId === "all") return members.map((m) => m.id);
    if (form.memberId) return [form.memberId];
    return [];
  }, [form.memberId, members]);

  /** مبلغ هر رکورد بعد از اعمال حالت گروهی (برای هشدار مشابه و پیش‌نمایش زنده) */
  const targetAmounts = useMemo(() => {
    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    if (targetMemberIds.length === 0) return [amount];
    if (targetMemberIds.length === 1 || form.splitMode === "perMember") {
      return targetMemberIds.map(() => amount);
    }
    const base = Math.floor(amount / targetMemberIds.length);
    const rem = amount - base * targetMemberIds.length;
    return targetMemberIds.map((_, i) => (i < rem ? base + 1 : base));
  }, [form.amount, form.splitMode, targetMemberIds]);

  /** همه تراکنش‌ها: واریزی‌ها + برداشت‌های متفرقه + پرداخت اقساط + تسهیلات پرداختی */
  const txRows = useMemo<TxRow[]>(() => {
    const rows: TxRow[] = [];
    deposits.forEach((d) => {
      rows.push({
        id: `d-${d.id}`,
        // جلسه ۵۹ — همهٔ انواع withdraw_* در گروه برداشت قرمز هستند
        group: isWithdrawType(d.type) ? "withdraw" : "deposit",
        kindLabel: TYPE_LABELS[d.type || "share"],
        title: d.title || "",
        member: d.memberId ? d.memberName || "" : `${d.memberName || ""} (بدون عضو)`,
        amount: Number(d.amount) || 0,
        at: d.createdAt,
        periodKey: d.type === "share" ? d.periodKey || "" : "",
        deposit: d,
        loan: null,
        payment: null,
        paymentIndex: 0,
      });
    });
    loans.forEach((loan) => {
      const disbursed = Number(loan.disbursedAmount) || 0;
      if (disbursed > 0) {
        rows.push({
          id: `w-${loan.id}`,
          group: "withdraw",
          kindLabel: "تسهیلات پرداختی",
          title: "",
          member: loan.memberName || "",
          amount: disbursed,
          at: loan.createdAt,
          periodKey: "",
          deposit: null,
          loan,
          payment: null,
          paymentIndex: 0,
        });
      }
      (loan.payments || []).forEach((p, i) => {
        rows.push({
          id: `p-${p.id}-${i}`,
          group: "deposit",
          kindLabel: "پرداخت اقساط تسهیلات",
          title: "",
          member: loan.memberName || "",
          amount: Number(p.amount) || 0,
          at: p.paidAt,
          periodKey: "",
          deposit: null,
          loan,
          payment: p,
          paymentIndex: i + 1,
        });
      });
    });
    rows.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return rows;
  }, [deposits, loans]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query);
    return txRows.filter((r) => {
      if (group !== "all" && r.group !== group) return false;
      if (!q) return true;
      return normalizeSearchText(
        `${r.member} ${r.title} ${r.kindLabel} ${r.amount} ${r.periodKey}`,
      ).includes(q);
    });
  }, [txRows, group, query]);

  function openAdd() {
    setFormOpen(true);
    setDupPending(null);
    setError("");
    setForm({
      direction: "deposit",
      memberId: "",
      type: "misc",
      splitMode: "perMember",
      title: TYPE_LABELS.misc,
      amount: "",
      period: "",
    });
    setDateIso("");
  }

  /** جلسه ۵۹ — عنوان پیش‌فرض هر نوع؛ اگر مدیر عنوان دیگری نوشته باشد دست نمی‌خورد */
  function titleForType(type: BankDepositType): string {
    return TYPE_LABELS[type];
  }

  /** جلسه ۵۹ — تغییر گروه واریز/برداشت: نوع به مجموعهٔ همان گروه برمی‌گردد */
  function switchDirection(direction: "deposit" | "withdraw") {
    setForm((prev) => {
      const type =
        direction === "withdraw"
          ? ("withdraw_misc" as BankDepositType)
          : ("misc" as BankDepositType);
      return {
        ...prev,
        direction,
        type,
        title:
          prev.title === "" || Object.values(TYPE_LABELS).includes(prev.title)
            ? titleForType(type)
            : prev.title,
      };
    });
  }

  /** ماه واریزی برای هشدار مشابه: سهام از دوره، بقیه از ماه جاری (createdAt سمت سرور) */
  function depositMonthOf(d: BankDeposit): string {
    return d.type === "share" && d.periodKey ? d.periodKey : monthKey(new Date(d.createdAt));
  }

  /** ماه تراکنش برای هشدار مشابه: سهام از دوره، بقیه از ماه تقویم/جاری */
  function targetMonth(): string | null {
    if (form.direction === "deposit" && form.type === "share") return resolvedPeriod;
    return dateIso ? monthKey(new Date(dateIso)) : monthKey(new Date());
  }

  function findDuplicate(): BankDeposit | null {
    if (settings?.duplicateWarning === false) return null;
    if (targetAmounts.length === 0) return null;
    const month = targetMonth();
    if (!month) return null;
    const amounts = new Set(targetAmounts.map((a) => Number(a)));
    const ids = new Set(targetMemberIds);
    return (
      deposits.find(
        (d) =>
          (targetMemberIds.length === 0
            ? (d.memberId || null) === null
            : ids.has(d.memberId || "")) &&
          amounts.has(Number(d.amount)) &&
          depositMonthOf(d) === month,
      ) || null
    );
  }

  /** اعتبارسنجی سمت کلاینت قبل از ارسال — پیام فارسی دقیق برای هر خطا */
  function validateForm(): string {
    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "مبلغ تراکنش باید عددی بزرگ‌تر از صفر باشد.";
    }
    if (form.memberId === "all" && members.length === 0) {
      return "هنوز عضوی در بانک ثبت نشده است.";
    }
    if (form.memberId === "" && MEMBER_REQUIRED_TYPES.includes(form.type)) {
      if (form.type === "share") return "برای واریز سهام باید عضو انتخاب شود.";
      if (form.type === "installment") return "برای ثبت پرداخت قسط باید عضو انتخاب شود.";
      if (form.type === "withdraw_share") return "برای برداشت سهام باید عضو انتخاب شود.";
      return "برای برداشت قسط باید عضو انتخاب شود.";
    }
    if (
      form.memberId === "all" &&
      form.splitMode === "total" &&
      amount < members.length
    ) {
      return "مبلغ کل برای تقسیم مساوی بین همهٔ اعضا کافی نیست.";
    }
    return "";
  }

  async function submitForm(force = false) {
    const invalid = validateForm();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!force) {
        const dup = findDuplicate();
        if (dup) {
          setDupPending(dup);
          setBusy(false);
          return;
        }
      }
      setDupPending(null);
      const response = await fetch("/api/bank/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // جلسه ۵۹ — خودِ نوع جهت را حمل می‌کند: انواع withdraw_* برداشت‌اند
          type: form.type,
          memberIds:
            form.memberId === "all"
              ? members.map((m) => m.id)
              : form.memberId
                ? [form.memberId]
                : null,
          splitMode: form.splitMode,
          title: form.title.trim(),
          amount: parseAmount(form.amount),
          periodKey:
            form.direction === "deposit" && form.type === "share"
              ? resolvedPeriod || ""
              : undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت تراکنش ناموفق بود.");
        return;
      }
      setFormOpen(false);
      setForm({
        direction: "deposit",
        memberId: "",
        type: "misc",
        splitMode: "perMember",
        title: TYPE_LABELS.misc,
        amount: "",
        period: "",
      });
      setDateIso("");
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bank/deposits/${deleting.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "حذف واریزی ناموفق بود.");
        return;
      }
      setDeleting(null);
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitles(next: string[]) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bank/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositTitles: next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ذخیره عنوان‌ها ناموفق بود.");
        return;
      }
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام، عنوان، مبلغ…"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white dark:bg-primary-500 dark:text-white"
        >
          ثبت تراکنش
        </button>
        <button
          type="button"
          onClick={() => setTitlesOpen(!titlesOpen)}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          عنوان‌های آماده
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "تراکنش‌ها",
              ["گروه", "نوع", "عنوان", "عضو", "مبلغ", "دوره", "تاریخ ثبت"],
              filtered.map((r) => [
                r.group === "deposit" ? "واریز" : "برداشت",
                r.kindLabel,
                r.title || "—",
                r.member || "—",
                r.amount,
                r.periodKey || "—",
                faDate(r.at),
              ]),
            )
          }
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          خروجی CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* زیرمجموعه واریز/برداشت — جلسه ۲۶ */}
      <div className="flex gap-2">
        {GROUP_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setGroup(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              group === f.key
                ? "bg-gradient-to-l from-primary-700 to-primary-500 text-white shadow-md shadow-primary-600/25"
                : "border border-zinc-200 bg-white text-zinc-500 hover:border-primary-300 hover:text-primary-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {titlesOpen && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-medium">مدیریت عنوان‌های آماده واریزی</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {titles.length === 0 && (
              <li className="text-xs text-zinc-500">هنوز عنوانی ثبت نشده است.</li>
            )}
            {titles.map((title) => (
              <li
                key={title}
                className="flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800"
              >
                {title}
                <button
                  type="button"
                  onClick={() => saveTitles(titles.filter((t) => t !== title))}
                  className="text-red-600 dark:text-red-400"
                  aria-label={`حذف عنوان ${title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="عنوان جدید…"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={busy || !newTitle.trim()}
              onClick={() => {
                void saveTitles([...titles, newTitle.trim()]);
                setNewTitle("");
              }}
              className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
            >
              افزودن عنوان
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitForm();
          }}
          className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-sm font-medium">ثبت تراکنش</h3>

          {/* جلسه ۵۸ — گروه تراکنش: واریز یا برداشت (هر دو به درخواست کاربر) */}
          <div className="flex gap-2">
            {([
              { key: "deposit" as const, label: "واریز" },
              { key: "withdraw" as const, label: "برداشت" },
            ]).map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => switchDirection(g.key)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                  form.direction === g.key
                    ? g.key === "deposit"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "bg-red-600 text-white shadow-md shadow-red-600/25"
                    : "border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-500">
              عضو
              <select
                value={form.memberId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    memberId: e.target.value,
                    // انواعی که عضو می‌خواهند (سهام، پرداخت قسط، برداشت سهام/قسط) با
                    // انتخاب «بدون عضو» به نوع پیش‌فرض همان گروه برمی‌گردند
                    type:
                      e.target.value === "" && MEMBER_REQUIRED_TYPES.includes(prev.type)
                        ? prev.direction === "withdraw"
                          ? ("withdraw_misc" as BankDepositType)
                          : ("misc" as BankDepositType)
                        : prev.type,
                  }))
                }
                className={`${inputClass} w-full`}
              >
                <option value="all">همه اعضا ({faNum(members.length)} عضو)</option>
                <option value="">
                  {form.direction === "withdraw"
                    ? "برداشت بدون عضو (از موجودی بانک)"
                    : "واریزی متفرقه (بدون عضو)"}
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {/* جلسه ۵۹ — «نوع تراکنش» در هر دو گروه همان دسته‌ها را دارد:
                واریز: پرداخت قسط، پرداخت سهام، سود بانک، متفرقه —
                برداشت: برداشت قسط، برداشت سهام، برداشت سود بانک، برداشت متفرقه */}
            <label className="space-y-1 text-xs text-zinc-500">
              نوع تراکنش
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as BankDepositType;
                  setForm((prev) => ({
                    ...prev,
                    type,
                    title: prev.title === "" || Object.values(TYPE_LABELS).includes(prev.title)
                      ? titleForType(type)
                      : prev.title,
                  }));
                }}
                className={`${inputClass} w-full`}
              >
                {(form.direction === "deposit" ? FORM_DEPOSIT_TYPES : FORM_WITHDRAW_TYPES)
                  .filter(
                    (t) =>
                      !MEMBER_REQUIRED_TYPES.includes(t) || form.memberId !== "",
                  )
                  .map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
              </select>
            </label>
            {form.memberId === "all" && (
              <label className="space-y-1 text-xs text-zinc-500">
                حالت مبلغ گروهی
                <select
                  value={form.splitMode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      splitMode: e.target.value === "total" ? ("total" as const) : ("perMember" as const),
                    }))
                  }
                  className={`${inputClass} w-full`}
                >
                  <option value="perMember">مبلغ برای هر عضو</option>
                  <option value="total">مبلغ کل — تقسیم مساوی بین همه</option>
                </select>
              </label>
            )}
            <label className="space-y-1 text-xs text-zinc-500">
              عنوان
              <input
                list="deposit-titles-list"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="از فهرست یا آزاد…"
                className={`${inputClass} w-full`}
              />
              <datalist id="deposit-titles-list">
                {titles.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              مبلغ (تومان) *
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                className={`${inputClass} w-full`}
              />
            </label>
            {form.direction === "deposit" && form.type === "share" && (
              <label className="space-y-1 text-xs text-zinc-500">
                دوره ماه شمسی
                <input
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="۱۴۰۵/۰۸ یا آبان ۱۴۰۵…"
                  className={`${inputClass} w-full`}
                />
                {resolvedPeriod && (
                  <span className="text-[11px] text-zinc-400">
                    دوره استاندارد: {resolvedPeriod}
                  </span>
                )}
              </label>
            )}
          </div>

          {/* جلسه ۵۸ — پیش‌نمایش زندهٔ ثبت گروهی: هر عضو چه مبلغی می‌گیرد */}
          {form.memberId === "all" && targetAmounts.length > 0 && (
            <p className="rounded-xl border border-primary-200 bg-primary-50/60 px-3 py-2 text-[11px] leading-5 text-primary-800 dark:border-primary-900 dark:bg-primary-950/40 dark:text-primary-200">
              {form.splitMode === "perMember"
                ? `هر عضو ${faNum(targetAmounts[0])} تومان — جمع برای ${faNum(members.length)} عضو: ${faNum(targetAmounts[0] * members.length)} تومان`
                : `مبلغ کل ${faNum(parseAmount(form.amount))} تومان بین ${faNum(members.length)} عضو تقسیم می‌شود — هر عضو حدود ${faNum(targetAmounts[0])} تومان`}
              {" "}
              (برای ثبت گروهی — تقسیم سود، برداشت یا واریزی متفرقهٔ همه اعضا)
            </p>
          )}

          <div className="space-y-1 text-xs text-zinc-500">
            تاریخ (از تقویم شمسی — برای دوره سهام به‌کار می‌رود)
            <JalaliCalendar
              value={dateIso}
              onChange={(iso) => {
                setDateIso(iso);
                if (form.direction === "deposit" && form.type === "share") {
                  setForm((prev) => ({
                    ...prev,
                    period: monthKey(new Date(iso)),
                  }));
                }
              }}
            />
          </div>

          {dupPending && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p>
                هشدار تراکنش مشابه:{" "}
                {form.memberId === "all"
                  ? "برای یکی از اعضای هدف، تراکنش مشابهی همین حالا ثبت شده است — "
                  : "تراکنش مشابهی همین حالا ثبت شده است — "}
                {dupPending.memberName}، {toMoney(Number(dupPending.amount))}،{" "}
                {TYPE_LABELS[dupPending.type]}
                {dupPending.periodKey ? `، ماه ${dupPending.periodKey}` : ""}.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitForm(true)}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  ثبت با وجود هشدار
                </button>
                <button
                  type="button"
                  onClick={() => setDupPending(null)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
            >
              ثبت تراکنش
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
            >
              بستن فرم
            </button>
          </div>
        </form>
      )}

      {deleting && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p>
            {isWithdrawType(deleting.type) ? "برداشت" : "واریزی"} «{" "}
            {deleting.title}» به مبلغ {toMoney(Number(deleting.amount))} حذف شود؟
            این کار اعتبار و مانده اعضا را به‌روز می‌کند.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              بله، حذف
            </button>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        {faNum(filtered.length)} از {faNum(txRows.length)} تراکنش — برای دیدن جزئیات کامل هر تراکنش، آن را لمس کنید.
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {txRows.length === 0
            ? "هنوز تراکنشی ثبت نشده است؛ با «ثبت تراکنش» شروع کنید."
            : "تراکنشی مطابق جست‌وجو پیدا نشد."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              {/* جلسه ۵۰ — با لمس هر تراکنش مودال جزئیات کامل آن باز می‌شود؛
                  واریز با حاشیه/زمینه سبز و برداشت با حاشیه/زمینه قرمز مشخص است */}
              <button
                type="button"
                onClick={() => setDetailRow(r)}
                aria-label={`جزئیات تراکنش ${r.kindLabel}${r.member ? ` — ${r.member}` : ""}`}
                className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border p-4 text-right shadow-sm transition active:scale-[0.99] ${
                  r.group === "deposit"
                    ? "border-emerald-200 border-r-4 border-r-emerald-500 bg-emerald-50/70 hover:border-emerald-300 dark:border-emerald-900 dark:border-r-emerald-500 dark:bg-emerald-950/30"
                    : "border-red-200 border-r-4 border-r-red-500 bg-red-50/70 hover:border-red-300 dark:border-red-900 dark:border-r-red-500 dark:bg-red-950/30"
                }`}
              >
              <div className="space-y-1">
                {/* جلسه ۵۱ — عنوان ردیف فقط «واریز»/«برداشت» است (به درخواست کاربر)؛
                    نوع تراکنش در بج کوچک کنار عنوان و بقیهٔ توضیحات در مودال جزئیات */}
                <p className="text-sm font-bold">
                  {r.group === "deposit" ? "واریز" : "برداشت"}
                  <span
                    className={`mr-2 rounded-lg px-2 py-0.5 text-[11px] font-normal ${
                      r.group === "deposit"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                    }`}
                  >
                    {r.kindLabel}
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  {[
                    r.member || "—",
                    r.title && r.title !== r.kindLabel ? `عنوان: ${r.title}` : "",
                    r.periodKey ? `دوره ${r.periodKey}` : "",
                    faDate(r.at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    r.group === "deposit"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {r.group === "deposit" ? "+" : "−"}
                  {toMoney(r.amount)}
                </p>
                {r.deposit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // حذف نباید مودال جزئیات را هم باز کند
                      setDeleting(r.deposit!);
                    }}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 dark:border-red-900 dark:text-red-400"
                  >
                    حذف
                  </button>
                )}
              </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* جلسه ۵۰ — مودال جزئیات کامل تراکنش لمس‌شده */}
      {detailRow && (
        <div data-swipe-ignore className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">جزئیات تراکنش</h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label="بستن جزئیات"
                className="grid size-8 place-items-center rounded-full text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
              >
                ×
              </button>
            </div>
            <div className="space-y-1.5">
              {detailLines(detailRow).map((line, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-900"
                >
                  <span className="shrink-0 text-xs text-zinc-500">{line.label}</span>
                  <span
                    className={`min-w-0 text-left text-xs font-medium leading-6 ${
                      line.tone === "green"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : line.tone === "red"
                          ? "text-red-700 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDetailRow(null)}
              className="mt-4 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 dark:bg-primary-500"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
