"use client";

import { useMemo, useState } from "react";
import {
  jalaliParts,
  loanPaid,
  loanRemaining,
  loanTotals,
  makeSchedule,
  normalizeSearchText,
  parseAmount,
} from "@/lib/bank";
import type { BankLoan, BankMember } from "@/lib/db";
import JalaliCalendar from "./JalaliCalendar";
import { useHydrated } from "./useHydrated";
import { downloadCsv } from "./csv";

type LoansTabProps = {
  members: BankMember[];
  loans: BankLoan[];
  onRefresh: () => void;
};

type LoanFormState = {
  memberId: string;
  principal: string;
  interestAmount: string;
  interestMode: "beginning" | "end";
  months: string;
  firstDue: string;
  scheduleMode: "auto" | "manual";
  manualText: string;
  note: string;
};

const EMPTY_FORM: LoanFormState = {
  memberId: "",
  principal: "",
  interestAmount: "",
  interestMode: "end",
  months: "",
  firstDue: "",
  scheduleMode: "auto",
  manualText: "",
  note: "",
};

const LOAN_STATUS_LABELS: Record<BankLoan["status"], string> = {
  active: "جاری",
  paid: "تسویه‌شده",
  cancelled: "لغو‌شده",
};

const LOAN_STATUS_TONE: Record<BankLoan["status"], string> = {
  active: "border-zinc-200 text-zinc-500 dark:border-zinc-800",
  paid: "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400",
  cancelled: "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400",
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

/** تبدیل ISO انتخاب‌شده از تقویم به رشته شمسی ۱۴۰۵/۰۸/۲۷ برای ورودی‌های فرم */
function isoToJalaliText(iso: string): string {
  const parts = jalaliParts(new Date(iso));
  if (!parts.year) return "";
  return `${parts.year}/${String(parts.month).padStart(2, "0")}/${String(
    parts.day,
  ).padStart(2, "0")}`;
}

type PaymentFormState = {
  loanId: string;
  amount: string;
  paidAt: string;
  note: string;
};

export default function LoansTab({ members, loans, onRefresh }: LoansTabProps) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LoanFormState>(EMPTY_FORM);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState | null>(null);
  const [deleting, setDeleting] = useState<BankLoan | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<{
    loanId: string;
    paymentId: string;
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sorted = useMemo(() => {
    if (!hydrated) return [];
    return [...loans].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [loans, hydrated]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return sorted;
    return sorted.filter((l) =>
      normalizeSearchText(
        `${l.memberName} ${l.note} ${l.principal} ${l.totalAmount}`,
      ).includes(q),
    );
  }, [sorted, query]);

  /** پیش‌نمایش زنده جدول اقساط با makeSchedule — فقط پس از hydration */
  const preview = useMemo(() => {
    if (!hydrated || !formOpen) return null;
    const principal = parseAmount(form.principal);
    if (principal <= 0) return null;
    const interest =
      form.interestAmount === "" ? 0 : parseAmount(form.interestAmount);
    const months = Math.floor(parseAmount(form.months));
    if (months <= 0 || !form.firstDue.trim()) {
      const totals = loanTotals(principal, interest, form.interestMode);
      return {
        ...totals,
        schedule: null as null | ReturnType<typeof makeSchedule>,
        previewError: "",
      };
    }
    const totals = loanTotals(principal, interest, form.interestMode);
    try {
      const schedule = makeSchedule({
        total: totals.totalAmount,
        months,
        firstDue: form.firstDue,
        mode: form.scheduleMode,
        manualText: form.manualText,
      });
      return { ...totals, schedule, previewError: "" };
    } catch (err) {
      return {
        ...totals,
        schedule: null,
        previewError:
          err instanceof Error ? err.message : "پیش‌نمایش اقساط ناموفق بود.",
      };
    }
  }, [hydrated, formOpen, form]);

  function openAdd() {
    setFormOpen(true);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submitLoan(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bank/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: form.memberId,
          principal: parseAmount(form.principal),
          interestAmount:
            form.interestAmount === "" ? 0 : parseAmount(form.interestAmount),
          interestMode: form.interestMode,
          installmentCount: Math.floor(parseAmount(form.months)),
          firstDue: form.firstDue.trim(),
          scheduleMode: form.scheduleMode,
          manualText: form.manualText,
          note: form.note.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت وام ناموفق بود.");
        return;
      }
      setForm(EMPTY_FORM);
      setFormOpen(false);
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment(loan: BankLoan) {
    if (!paymentForm) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bank/loans/${loan.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseAmount(paymentForm.amount),
          paidAt: paymentForm.paidAt.trim(),
          note: paymentForm.note.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت پرداخت ناموفق بود.");
        return;
      }
      setPaymentForm(null);
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
      const response = await fetch(`/api/bank/loans/${deleting.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "حذف وام ناموفق بود.");
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

  async function confirmDeletePayment() {
    if (!deletingPayment) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bank/loans/${deletingPayment.loanId}/payments?paymentId=${encodeURIComponent(
          deletingPayment.paymentId,
        )}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "حذف پرداخت ناموفق بود.");
        return;
      }
      setDeletingPayment(null);
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  /** خلاصه وام‌ها: پرداخت‌شدهٔ وام‌های در جریان، تسویه‌شده‌ها و مانده کل */
  const totals = useMemo(() => {
    let inProgressPaid = 0;
    let inProgressRemaining = 0;
    let inProgressCount = 0;
    let settledPaid = 0;
    let settledCount = 0;
    for (const loan of sorted) {
      if (loan.status === "cancelled") continue;
      if (loan.status === "paid") {
        settledPaid += loanPaid(loan);
        settledCount += 1;
      } else {
        inProgressPaid += loanPaid(loan);
        inProgressRemaining += loanRemaining(loan);
        inProgressCount += 1;
      }
    }
    return { inProgressPaid, inProgressRemaining, inProgressCount, settledPaid, settledCount };
  }, [sorted]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 shadow-sm dark:border-primary-900 dark:bg-primary-950/40">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            کل مبالغ وام پرداختی در جریان
          </p>
          <p className="mt-1 text-lg font-bold text-primary-700 sm:text-xl dark:text-primary-300">
            {toMoney(totals.inProgressPaid)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {totals.inProgressCount > 0
              ? `${faNum(totals.inProgressCount)} وام در جریان — مانده بازپرداخت: ${toMoney(totals.inProgressRemaining)}`
              : "وام در جریانی وجود ندارد"}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">کل مبالغ تسویه‌شده</p>
          <p className="mt-1 text-lg font-bold text-emerald-700 sm:text-xl dark:text-emerald-300">
            {toMoney(totals.settledPaid)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {totals.settledCount > 0
              ? `${faNum(totals.settledCount)} وام تسویه‌شده`
              : "وام تسویه‌شده‌ای وجود ندارد"}
          </p>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام، یادداشت، مبلغ…"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white dark:bg-primary-500 dark:text-white"
        >
          ثبت وام
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "وام‌ها",
              [
                "عضو",
                "تاریخ ثبت",
                "اصل",
                "سود",
                "جمع وام",
                "پرداخت‌شده",
                "مانده",
                "اقساط",
                "وضعیت",
              ],
              filtered.map((l) => [
                l.memberName || "—",
                faDate(l.createdAt),
                l.principal,
                l.interestAmount,
                l.totalAmount,
                loanPaid(l),
                loanRemaining(l),
                `${l.payments.length}/${l.installmentCount}`,
                LOAN_STATUS_LABELS[l.status],
              ]),
            )
          }
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          خروجی CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {formOpen && (
        <form
          onSubmit={submitLoan}
          className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-sm font-medium">ثبت وام</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-500">
              عضو *
              <select
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                required
                className={`${inputClass} w-full`}
              >
                <option value="">انتخاب عضو…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              اصل وام (تومان) *
              <input
                inputMode="numeric"
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
                placeholder="۱۰٬۰۰۰٬۰۰۰"
                required
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              سود وام (تومان)
              <input
                inputMode="numeric"
                value={form.interestAmount}
                onChange={(e) =>
                  setForm({ ...form, interestAmount: e.target.value })
                }
                placeholder="۰ = بدون سود"
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              حالت سود
              <select
                value={form.interestMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    interestMode: e.target.value as "beginning" | "end",
                  })
                }
                className={`${inputClass} w-full`}
              >
                <option value="end">اضافه به انتها (به کل بدهی اضافه می‌شود)</option>
                <option value="beginning">
                  کسر از ابتدا (از اصل وام کسر می‌شود)
                </option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              تعداد اقساط (ماه) *
              <input
                type="number"
                min={1}
                step={1}
                value={form.months}
                onChange={(e) => setForm({ ...form, months: e.target.value })}
                required
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              تاریخ اولین قسط شمسی *
              <input
                value={form.firstDue}
                onChange={(e) => setForm({ ...form, firstDue: e.target.value })}
                placeholder="۱۴۰۵/۰۸/۲۷"
                required
                dir="ltr"
                className={`${inputClass} w-full text-left`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              حالت جدول اقساط
              <select
                value={form.scheduleMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    scheduleMode: e.target.value as "auto" | "manual",
                  })
                }
                className={`${inputClass} w-full`}
              >
                <option value="auto">خودکار (اقساط مساوی، قسط آخر مابقی)</option>
                <option value="manual">دستی (مبلغ‌ها را خودم می‌دهم)</option>
              </select>
            </label>
          </div>

          {form.scheduleMode === "manual" && (
            <label className="block space-y-1 text-xs text-zinc-500">
              مبلغ اقساط دستی (با کاما یا خط جدید — جمع باید دقیقاً کل بدهی شود)
              <textarea
                rows={3}
                value={form.manualText}
                onChange={(e) => setForm({ ...form, manualText: e.target.value })}
                placeholder="۲٬۰۰۰٬۰۰۰، ۲٬۰۰۰٬۰۰۰، ۲٬۰۰۰٬۰۰۰…"
                className={`${inputClass} w-full`}
              />
            </label>
          )}

          <div className="space-y-1 text-xs text-zinc-500">
            تقویم شمسی — انتخاب تاریخ اولین قسط
            <JalaliCalendar
              value={form.firstDue ? String(form.firstDue) : ""}
              onChange={(iso) =>
                setForm((prev) => ({ ...prev, firstDue: isoToJalaliText(iso) }))
              }
            />
          </div>

          {preview && (
            <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="text-xs font-medium text-zinc-500">
                پیش‌نمایش وام و جدول اقساط
              </h4>
              <p className="text-xs">
                کل بدهی {toMoney(preview.totalAmount)} · مبلغ پرداختی به عضو{" "}
                {toMoney(preview.disbursedAmount)}
                {form.interestMode === "beginning" && preview.disbursedAmount < preview.totalAmount
                  ? " (سود از اصل کسر شد)"
                  : ""}
              </p>
              {preview.previewError ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {preview.previewError}
                </p>
              ) : preview.schedule ? (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-right text-xs">
                    <thead className="sticky top-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">قسط</th>
                        <th className="px-2 py-1.5 font-medium">مبلغ</th>
                        <th className="px-2 py-1.5 font-medium">سررسید</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.schedule.map((inst) => (
                        <tr
                          key={inst.id}
                          className="border-t border-zinc-200 dark:border-zinc-800"
                        >
                          <td className="px-2 py-1.5">{faNum(inst.number)}</td>
                          <td className="px-2 py-1.5">{toMoney(inst.amount)}</td>
                          <td className="px-2 py-1.5">{faDate(inst.dueAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  برای پیش‌نمایش جدول اقساط، تعداد اقساط و تاریخ اولین قسط را
                  کامل کنید.
                </p>
              )}
            </div>
          )}

          <label className="block space-y-1 text-xs text-zinc-500">
            یادداشت
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={`${inputClass} w-full`}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
            >
              ثبت وام
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
            وام {toMoney(deleting.principal)} برای «{deleting.memberName}» با تمام
            پرداخت‌هایش حذف شود؟
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

      {deletingPayment && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p>
            پرداخت {deletingPayment.label} حذف شود؟ مانده وام و وضعیت آن به‌روز
            می‌شود.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmDeletePayment}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              بله، حذف پرداخت
            </button>
            <button
              type="button"
              onClick={() => setDeletingPayment(null)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        {faNum(filtered.length)} از {faNum(loans.length)} وام
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {loans.length === 0
            ? "هنوز وامی ثبت نشده است؛ با «ثبت وام» شروع کنید."
            : "وامی مطابق جست‌وجو پیدا نشد."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((loan) => {
            const paid = loanPaid(loan);
            const remaining = loanRemaining(loan);
            return (
              <li
                key={loan.id}
                className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">
                      وام {loan.memberName}
                      <span
                        className={`mr-2 rounded-lg border px-2 py-0.5 text-[11px] font-normal ${LOAN_STATUS_TONE[loan.status]}`}
                      >
                        {LOAN_STATUS_LABELS[loan.status]}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      اصل {toMoney(loan.principal)} ·{" "}
                      {loan.interestMode === "beginning"
                        ? "سود کسر از ابتدا"
                        : "سود اضافه به انتها"}{" "}
                      {toMoney(loan.interestAmount)} · کل بدهی{" "}
                      {toMoney(loan.totalAmount)} · پرداختی به عضو{" "}
                      {toMoney(loan.disbursedAmount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm({
                          loanId: loan.id,
                          amount: "",
                          paidAt: "",
                          note: "",
                        })
                      }
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-emerald-500"
                    >
                      ثبت پرداخت قسط
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(loan)}
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 dark:border-red-900 dark:text-red-400"
                    >
                      حذف وام
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] text-zinc-500">مانده وام</dt>
                    <dd className="font-semibold">{toMoney(remaining)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">پرداخت‌شده</dt>
                    <dd>{toMoney(paid)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">اقساط</dt>
                    <dd>
                      {faNum(loan.installmentCount)} قسط · هر قسط ≈{" "}
                      {toMoney(
                        loan.schedule[0]
                          ? Math.round(loan.totalAmount / loan.installmentCount)
                          : 0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">تاریخ ثبت</dt>
                    <dd>{faDate(loan.createdAt)}</dd>
                  </div>
                </dl>

                {loan.note && (
                  <p className="text-xs text-zinc-500">{loan.note}</p>
                )}

                <details>
                  <summary className="cursor-pointer text-xs text-zinc-500">
                    جدول اقساط ({faNum(loan.schedule.length)})
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">قسط</th>
                          <th className="px-2 py-1.5 font-medium">مبلغ</th>
                          <th className="px-2 py-1.5 font-medium">سررسید</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loan.schedule.map((inst) => (
                          <tr
                            key={inst.id}
                            className="border-t border-zinc-200 dark:border-zinc-800"
                          >
                            <td className="px-2 py-1.5">{faNum(inst.number)}</td>
                            <td className="px-2 py-1.5">{toMoney(inst.amount)}</td>
                            <td className="px-2 py-1.5">{faDate(inst.dueAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {paymentForm?.loanId === loan.id && (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <h4 className="text-xs font-medium">ثبت پرداخت قسط</h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        inputMode="numeric"
                        value={paymentForm.amount}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, amount: e.target.value })
                        }
                        placeholder="مبلغ (تومان)"
                        className={`${inputClass} w-full`}
                      />
                      <input
                        value={paymentForm.paidAt}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, paidAt: e.target.value })
                        }
                        placeholder="تاریخ ۱۴۰۵/۰۹/۰۵ (خالی = امروز)"
                        dir="ltr"
                        className={`${inputClass} w-full text-left`}
                      />
                      <input
                        value={paymentForm.note}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, note: e.target.value })
                        }
                        placeholder="یادداشت پرداخت"
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <JalaliCalendar
                      value={paymentForm.paidAt}
                      onChange={(iso) =>
                        setPaymentForm({
                          ...paymentForm,
                          paidAt: isoToJalaliText(iso),
                        })
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitPayment(loan)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                      >
                        ثبت پرداخت
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentForm(null)}
                        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                )}

                {loan.payments.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-zinc-500">
                      پرداخت‌ها ({faNum(loan.payments.length)})
                    </h4>
                    <ul className="space-y-1">
                      {[...loan.payments]
                        .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
                        .map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                          >
                            <span>
                              {toMoney(p.amount)} · {faDate(p.paidAt)}
                              {p.note ? ` · ${p.note}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingPayment({
                                  loanId: loan.id,
                                  paymentId: p.id,
                                  label: `${toMoney(p.amount)} از ${faDate(p.paidAt)}`,
                                })
                              }
                              className="rounded-lg border border-red-200 px-2 py-1 text-red-600 transition-colors hover:border-red-400 dark:border-red-900 dark:text-red-400"
                            >
                              حذف پرداخت
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
