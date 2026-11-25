"use client";

import { useMemo, useState } from "react";
import {
  monthKey,
  normalizeSearchText,
  parseAmount,
  parseSharePeriod,
} from "@/lib/bank";
import type { BankDeposit, BankDepositType, BankLoan, BankMember, BankSettings } from "@/lib/db";
import JalaliCalendar from "./JalaliCalendar";
import { useHydrated } from "./useHydrated";
import { downloadCsv } from "./csv";

type DepositsTabProps = {
  members: BankMember[];
  deposits: BankDeposit[];
  /** وام‌ها — برای نمایش پرداخت اقساط و برداشت از بانک در فهرست تراکنش‌ها */
  loans: BankLoan[];
  settings: BankSettings | null;
  onRefresh: () => void;
};

/**
 * تب «تراکنش‌ها» (جلسه ۲۶ — نام قبلی: واریزی‌ها): همه تراکنش‌های بانک در یک
 * فهرست با زیرمجموعه واریز/برداشت — واریز سهام بانک، سود بانک، واریز متفرقه،
 * پرداخت اقساط تسهیلات و برداشت از بانک. فرم ثبت واریزی و مدیریت عنوان‌ها
 * مثل قبل کار می‌کنند؛ فقط واریزی‌ها قابل حذف‌اند (اقساط/برداشت از تب وام‌ها
 * مدیریت می‌شوند).
 */

const BANK_DEPOSIT_TYPES: BankDepositType[] = [
  "share",
  "loan_interest",
  "profit",
  "misc",
];

const TYPE_LABELS: Record<BankDepositType, string> = {
  share: "واریز سهام بانک",
  loan_interest: "سود بانک",
  profit: "واریز سود",
  misc: "واریز متفرقه",
};

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
  const [form, setForm] = useState({
    memberId: "",
    type: "share" as BankDepositType,
    title: "",
    amount: "",
    period: "",
  });
  const [dateIso, setDateIso] = useState("");
  const [deleting, setDeleting] = useState<BankDeposit | null>(null);
  const [dupPending, setDupPending] = useState<BankDeposit | null>(null);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const titles = settings?.depositTitles ?? [];

  /** دوره استاندارد سهام = پارس ورودی آزاد با مبنای تاریخ تقویم */
  const resolvedPeriod = useMemo(() => {
    if (!hydrated || form.type !== "share") return null;
    return parseSharePeriod(form.period, dateIso ? new Date(dateIso) : undefined);
  }, [hydrated, form.type, form.period, dateIso]);

  /** همه تراکنش‌ها: واریزی‌ها + پرداخت اقساط تسهیلات + برداشت از بانک */
  const txRows = useMemo<TxRow[]>(() => {
    const rows: TxRow[] = [];
    deposits.forEach((d) => {
      rows.push({
        id: `d-${d.id}`,
        group: "deposit",
        kindLabel: TYPE_LABELS[d.type || "share"],
        title: d.title || "",
        member: d.memberId ? d.memberName || "" : `${d.memberName || ""} (بدون عضو)`,
        amount: Number(d.amount) || 0,
        at: d.createdAt,
        periodKey: d.type === "share" ? d.periodKey || "" : "",
        deposit: d,
      });
    });
    loans.forEach((loan) => {
      const disbursed = Number(loan.disbursedAmount) || 0;
      if (disbursed > 0) {
        rows.push({
          id: `w-${loan.id}`,
          group: "withdraw",
          kindLabel: "برداشت از بانک",
          title: "",
          member: loan.memberName || "",
          amount: disbursed,
          at: loan.createdAt,
          periodKey: "",
          deposit: null,
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
    setForm({ memberId: "", type: "share", title: "", amount: "", period: "" });
    setDateIso("");
  }

  /** ماه واریزی برای هشدار مشابه: سهام از دوره، بقیه از ماه جاری (createdAt سمت سرور) */
  function depositMonthOf(d: BankDeposit): string {
    return d.type === "share" && d.periodKey ? d.periodKey : monthKey(new Date(d.createdAt));
  }

  function findDuplicate(): BankDeposit | null {
    if (settings?.duplicateWarning === false) return null;
    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const targetMonth =
      form.type === "share"
        ? resolvedPeriod
        : dateIso
          ? monthKey(new Date(dateIso))
          : monthKey(new Date());
    if (!targetMonth) return null;
    return (
      deposits.find(
        (d) =>
          (d.memberId || null) === (form.memberId || null) &&
          Number(d.amount) === amount &&
          depositMonthOf(d) === targetMonth,
      ) || null
    );
  }

  async function submitForm(force = false) {
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
          type: form.type,
          memberId: form.memberId || null,
          memberName: members.find((m) => m.id === form.memberId)?.name,
          title: form.title.trim(),
          amount: parseAmount(form.amount),
          periodKey: form.type === "share" ? resolvedPeriod || "" : undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت واریزی ناموفق بود.");
        return;
      }
      setFormOpen(false);
      setForm({ memberId: "", type: "share", title: "", amount: "", period: "" });
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
          ثبت واریزی
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
          <h3 className="text-sm font-medium">ثبت واریزی</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-500">
              عضو
              <select
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                className={`${inputClass} w-full`}
              >
                <option value="">واریزی متفرقه (بدون عضو)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              نوع واریزی
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as BankDepositType;
                  setForm((prev) => ({
                    ...prev,
                    type,
                    title: prev.title || TYPE_LABELS[type],
                  }));
                }}
                className={`${inputClass} w-full`}
              >
                {BANK_DEPOSIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
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
            {form.type === "share" && (
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

          <div className="space-y-1 text-xs text-zinc-500">
            تاریخ (از تقویم شمسی — برای دوره سهام به‌کار می‌رود)
            <JalaliCalendar
              value={dateIso}
              onChange={(iso) => {
                setDateIso(iso);
                if (form.type === "share") {
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
                هشدار تراکنش مشابه: واریزی مشابهی همین حالا ثبت شده است —{" "}
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
              ثبت واریزی
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
            واریزی «{deleting.title}» به مبلغ {toMoney(Number(deleting.amount))}{" "}
            حذف شود؟ این کار اعتبار و مانده اعضا را به‌روز می‌کند.
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
        {faNum(filtered.length)} از {faNum(txRows.length)} تراکنش
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {txRows.length === 0
            ? "هنوز تراکنشی ثبت نشده است؛ با «ثبت واریزی» شروع کنید."
            : "تراکنشی مطابق جست‌وجو پیدا نشد."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {r.kindLabel}
                  <span
                    className={`mr-2 rounded-lg px-2 py-0.5 text-[11px] font-normal ${
                      r.group === "deposit"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    }`}
                  >
                    {r.group === "deposit" ? "واریز" : "برداشت"}
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
                    onClick={() => setDeleting(r.deposit!)}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 dark:border-red-900 dark:text-red-400"
                  >
                    حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
