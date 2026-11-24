"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import type { BankMember, LoanRequest, PaymentRequest } from "@/lib/db";

function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [req, m] = await Promise.all([
        fetch("/api/admin/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [], loanRequests: [] })),
        fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
      ]);
      setPaymentRequests(Array.isArray(req.paymentRequests) ? req.paymentRequests : []);
      setLoanRequests(Array.isArray(req.loanRequests) ? req.loanRequests : []);
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
      setNotice(action === "approve" ? "درخواست تأیید و در صندوق ثبت شد." : "درخواست رد شد.");
      await load();
    } catch {
      setError("بررسی درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const pendingPayments = paymentRequests.filter((r) => r.status === "pending");
  const pendingLoans = loanRequests.filter((r) => r.status === "pending");
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">درخواست‌های اعضا</h2>
          <p className="text-xs text-zinc-500">
            تأیید پرداخت سهام، واریزی را در صندوق ثبت می‌کند؛ تأیید پرداخت قسط، آن را در وام ثبت می‌کند.
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
                      <strong>{r.username}</strong> —{" "}
                      {r.kind === "share"
                        ? `پرداخت سهام ${faMoney(r.amount)} تومان`
                        : `پرداخت قسط ${r.installmentNumber?.toLocaleString("fa-IR") ?? "—"} وام ${faMoney(r.amount)} تومان`}
                    </p>
                    <p className="text-xs text-zinc-500">
                      عضو: {memberName(r.memberId)} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                      {r.note ? ` — ${r.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview(r.receipt)}
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700"
                    >
                      دیدن رسید
                    </button>
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
                      <strong>{r.username}</strong> — تسهیلات {faMoney(r.amount)} تومانی /{" "}
                      {r.months.toLocaleString("fa-IR")} ماهه
                    </p>
                    <p className="text-xs text-zinc-500">
                      عضو: {memberName(r.memberId)} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                      {r.reason ? ` — ${r.reason}` : ""}
                    </p>
                    {r.status === "approved" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        یادآوری: وام واقعی را از بخش «وام‌ها و اقساط» صندوق ثبت کنید.
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
                          onClick={() => void review("loan", r.id, "approve")}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                        >
                          تأیید
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
