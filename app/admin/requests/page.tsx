"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import { jalaliParts, parseAmount } from "@/lib/bank";
import type { BankMember, LoanRequest, PaymentRequest } from "@/lib/db";

function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

/** تاریخ شمسی حدود یک ماه بعد از امروز — همان پیش‌فرض سمت سرور */
function defaultFirstDue(): string {
  const p = jalaliParts(new Date());
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

const STATUS_LABEL = { pending: "در انتظار تأیید", approved: "تأیید شده", rejected: "رد شده" } as const;
const STATUS_CLASS = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
} as const;

export default function AdminRequestsPage() {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [members, setMembers] = useState<BankMember[]>([]);
  const [lastReadAt, setLastReadAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<LoanRequest | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editReason, setEditReason] = useState("");
  const [approveTarget, setApproveTarget] = useState<LoanRequest | null>(null);
  const [approveInterest, setApproveInterest] = useState("0");
  const [approveInterestMode, setApproveInterestMode] = useState<"beginning" | "end">("end");
  const [approveFirstDue, setApproveFirstDue] = useState("");
  const [approveNote, setApproveNote] = useState("");
  // درخواست‌های pending که از آخرین بازدید ادمین جدیدترند = خوانده‌نشده
  const isUnread = useCallback(
    (r: { status: string; createdAt: string }) =>
      r.status === "pending" && (!lastReadAt || r.createdAt > lastReadAt),
    [lastReadAt],
  );
  const markedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [req, m] = await Promise.all([
        fetch("/api/admin/requests").then((r) =>
          r.ok ? r.json() : { paymentRequests: [], loanRequests: [] },
        ),
        fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
      ]);
      setPaymentRequests(Array.isArray(req.paymentRequests) ? req.paymentRequests : []);
      setLoanRequests(Array.isArray(req.loanRequests) ? req.loanRequests : []);
      setLastReadAt(typeof req.lastReadAt === "string" ? req.lastReadAt : "");
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setError("دریافت درخواست‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // بازدید ادمین از این صفحه = خواندن همه درخواست‌های pending تا همین لحظه؛
  // نشانگر سمت کلاینت عمداً به‌روز نمی‌شود تا نشان «خوانده‌نشده» تا پایان همین بازدید دیده بماند.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void fetch("/api/admin/requests/read", { method: "POST" }).catch(() => undefined);
  }, []);

  async function review(kind: "payment" | "loan", id: string, action: "approve" | "reject") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/requests/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "بررسی درخواست ناموفق بود.");
        return;
      }
      setNotice(
        action === "reject"
          ? "درخواست رد شد."
          : kind === "loan"
            ? "درخواست تسهیلات تأیید نهایی شد و وام به‌صورت خودکار در بانک ثبت شد (پنل ادمین و پنل عضو)."
            : "درخواست تأیید و در بانک ثبت شد.",
      );
      await load();
    } catch {
      setError("بررسی درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: LoanRequest) {
    setEditTarget(r);
    setEditAmount(String(r.amount));
    setEditMonths(String(r.months));
    setEditReason(r.reason);
  }

  function openApprove(r: LoanRequest) {
    setApproveTarget(r);
    setApproveInterest("0");
    setApproveInterestMode("end");
    setApproveFirstDue(defaultFirstDue());
    setApproveNote("");
  }

  async function submitApprove() {
    if (!approveTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/requests/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "loan",
          id: approveTarget.id,
          action: "approve",
          note: approveNote,
          interestAmount: approveInterest === "" ? 0 : parseAmount(approveInterest),
          interestMode: approveInterestMode,
          firstDue: approveFirstDue,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "تأیید نهایی درخواست ناموفق بود.");
        return;
      }
      setApproveTarget(null);
      setNotice(
        "درخواست تسهیلات تأیید نهایی شد و وام با شرایط تنظیم‌شده به‌صورت خودکار در بانک ثبت شد (پنل ادمین و پنل عضو).",
      );
      await load();
    } catch {
      setError("تأیید نهایی درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/requests/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          amount: parseAmount(editAmount),
          months: Number(editMonths),
          reason: editReason,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ویرایش درخواست ناموفق بود.");
        return;
      }
      setEditTarget(null);
      setNotice("درخواست ویرایش شد.");
      await load();
    } catch {
      setError("ویرایش درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const pendingPayments = paymentRequests.filter((r) => r.status === "pending");
  const pendingLoans = loanRequests.filter((r) => r.status === "pending");
  const unreadPayments = paymentRequests.filter(isUnread);
  const unreadLoans = loanRequests.filter(isUnread);
  const approveInterestValue = approveInterest === "" ? 0 : Math.max(0, parseAmount(approveInterest) || 0);
  const approvePrincipal = approveTarget?.amount ?? 0;
  const approveTotal =
    approveInterestMode === "beginning" ? approvePrincipal : approvePrincipal + approveInterestValue;
  const approveDisbursed =
    approveInterestMode === "beginning" ? Math.max(0, approvePrincipal - approveInterestValue) : approvePrincipal;
  const approveInstallment =
    approveTarget && approveTarget.months > 0 ? Math.floor(approveTotal / approveTarget.months) : 0;
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">درخواست‌های اعضا</h2>
          <p className="text-xs text-zinc-500">
            تأیید پرداخت سهام، واریزی را در بانک ثبت می‌کند؛ تأیید پرداخت قسط، آن را در وام ثبت می‌کند؛
            تأیید نهایی درخواست تسهیلات، وام را به‌صورت خودکار در بانک و پنل عضو ثبت می‌کند
            (می‌توانید قبل از تأیید، درخواست را ویرایش کنید).
          </p>
        </div>

        {notice && (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 text-sm font-medium">
            پرداخت‌های رسیده (سهام و اقساط) — {pendingPayments.length.toLocaleString("fa-IR")} در انتظار
            {unreadPayments.length > 0 && (
              <span className="mr-2 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {unreadPayments.length.toLocaleString("fa-IR")} خوانده‌نشده
              </span>
            )}
          </h3>
          {loading ? (
            <p className="text-xs text-zinc-500">در حال دریافت…</p>
          ) : paymentRequests.length === 0 ? (
            <p className="text-xs text-zinc-500">درخواست پرداختی وجود ندارد.</p>
          ) : (
            <div className="space-y-2">
              {paymentRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-900"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm">
                      {isUnread(r) && (
                        <span className="mr-1 ml-1 inline-block size-2 animate-pulse rounded-full bg-red-500 align-middle" aria-hidden="true" />
                      )}
                      <strong>{r.username}</strong> —{" "}
                      {r.kind === "share"
                        ? `پرداخت سهام ${faMoney(r.amount)} تومان`
                        : `پرداخت قسط ${r.installmentNumber?.toLocaleString("fa-IR") ?? "—"} وام ${faMoney(r.amount)} تومان`}
                      {isUnread(r) && (
                        <span className="mr-2 rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          خوانده‌نشده
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      عضو: {memberName(r.memberId)} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                      {r.note ? ` — ${r.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.receipt ? (
                      <button
                        type="button"
                        onClick={() => setPreview(r.receipt)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700"
                      >
                        دیدن رسید
                      </button>
                    ) : (
                      <span className="rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700">
                        {r.note ? "رسید متنی (بدون عکس)" : "بدون عکس رسید"}
                      </span>
                    )}
                    <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review("payment", r.id, "approve")}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                        >
                          تأیید
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review("payment", r.id, "reject")}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                        >
                          رد
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 text-sm font-medium">
            درخواست‌های تسهیلات — {pendingLoans.length.toLocaleString("fa-IR")} در انتظار
            {unreadLoans.length > 0 && (
              <span className="mr-2 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {unreadLoans.length.toLocaleString("fa-IR")} خوانده‌نشده
              </span>
            )}
          </h3>
          {loading ? (
            <p className="text-xs text-zinc-500">در حال دریافت…</p>
          ) : loanRequests.length === 0 ? (
            <p className="text-xs text-zinc-500">درخواستی وجود ندارد.</p>
          ) : (
            <div className="space-y-2">
              {loanRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-900"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm">
                      {isUnread(r) && (
                        <span className="mr-1 ml-1 inline-block size-2 animate-pulse rounded-full bg-red-500 align-middle" aria-hidden="true" />
                      )}
                      <strong>{r.username}</strong> — تسهیلات {faMoney(r.amount)} تومانی /{" "}
                      {r.months.toLocaleString("fa-IR")} ماهه
                      {isUnread(r) && (
                        <span className="mr-2 rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          خوانده‌نشده
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      عضو: {memberName(r.memberId)} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                      {r.reason ? ` — ${r.reason}` : ""}
                    </p>
                    {r.status === "approved" && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        وام این درخواست به‌صورت خودکار در بانک ثبت شد (تب «وام‌ها و اقساط» و پنل عضو).
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openEdit(r)}
                          className="rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700"
                        >
                          ویرایش
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openApprove(r)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                        >
                          تأیید نهایی
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review("loan", r.id, "reject")}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                        >
                          رد
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                ویرایش درخواست تسهیلات — {editTarget.username}
              </h3>
              <button type="button" onClick={() => setEditTarget(null)} className="text-zinc-400 hover:text-zinc-600">
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
              className="space-y-3"
            >
              <label className="block space-y-1 text-xs text-zinc-500">
                مبلغ تسهیلات (تومان)
                <input
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs text-zinc-500">
                مدت بازپرداخت (ماه)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editMonths}
                  onChange={(e) => setEditMonths(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs text-zinc-500">
                توضیحات یا دلیل درخواست
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <p className="text-xs text-zinc-500">
                پس از «تأیید نهایی»، وام با همین مبلغ و تعداد قسط ثبت می‌شود؛ سود، حالت سود
                و تاریخ اولین قسط را در پنجره تأیید نهایی می‌توانید تنظیم کنید و جدول اقساط
                بعداً از تب «وام‌ها و اقساط» قابل ویرایش است.
              </p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {busy ? "در حال ذخیره…" : "ذخیره تغییرات"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">تأیید نهایی تسهیلات — {approveTarget.username}</h3>
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ×
              </button>
            </div>
            <p className="mb-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              وام با مبلغ {faMoney(approveTarget.amount)} تومان و {faMoney(approveTarget.months)} قسط
              به‌صورت خودکار در بانک و پنل عضو ثبت می‌شود؛ سود و تاریخ اولین قسط را اینجا تنظیم کنید.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitApprove();
              }}
              className="space-y-3"
            >
              <label className="block space-y-1 text-xs text-zinc-500">
                سود وام (تومان)
                <input
                  value={approveInterest}
                  onChange={(e) => setApproveInterest(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="۰ = بدون سود"
                />
              </label>
              <label className="block space-y-1 text-xs text-zinc-500">
                حالت سود
                <select
                  value={approveInterestMode}
                  onChange={(e) => setApproveInterestMode(e.target.value as "beginning" | "end")}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="end">اضافه به انتها (به کل بدهی اضافه می‌شود)</option>
                  <option value="beginning">کسر از ابتدا (از اصل وام کسر می‌شود)</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs text-zinc-500">
                تاریخ اولین قسط (شمسی)
                <input
                  value={approveFirstDue}
                  onChange={(e) => setApproveFirstDue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="۱۴۰۵/۰۸/۲۷"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs text-zinc-500">
                یادداشت مدیر (اختیاری)
                <textarea
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                کل بازپرداخت: {faMoney(approveTotal)} تومان — قسط هر ماه حدوداً{" "}
                {faMoney(approveInstallment)} تومان ({faMoney(approveTarget.months)} قسط خودکار)
                {approveInterestMode === "beginning" && approveInterestValue > 0 && (
                  <> — مبلغ قابل پرداخت به عضو: {faMoney(approveDisbursed)} تومان</>
                )}
              </p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {busy ? "در حال ثبت وام…" : "تأیید نهایی و ثبت وام"}
                </button>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] max-w-lg overflow-auto rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">عکس رسید</h3>
              <button type="button" onClick={() => setPreview(null)} className="text-zinc-400 hover:text-zinc-600">
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="رسید" className="max-w-full rounded-xl" />
          </div>
        </div>
      )}
    </AdminShell>
  );
}
