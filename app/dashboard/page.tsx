"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { installmentStatuses, jalaliParts, memberShareDue, parseAmount, RECEIPT_COMPRESS_THRESHOLD_BYTES, RECEIPT_MAX_CHARS, RECEIPT_RAW_MAX_BYTES } from "@/lib/bank";
import AppearanceSettings from "@/app/components/bank/AppearanceSettings";
import type {
  BankDeposit,
  BankLoan,
  BankMember,
  BankSettings,
  LoanRequest,
  PaymentRequest,
  PublicUser,
} from "@/lib/db";

type TabKey = "shares" | "installments" | "loans" | "deposit" | "profile" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "shares", label: "سهام" },
  { key: "installments", label: "اقساط" },
  { key: "loans", label: "تسهیلات" },
  { key: "deposit", label: "واریز" },
  { key: "profile", label: "پروفایل" },
  { key: "settings", label: "تنظیمات" },
];

const STATUS_LABEL: Record<PaymentRequest["status"], string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  rejected: "رد شده",
};

const STATUS_CLASS: Record<PaymentRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

/** نمایش شماره کارت ۱۶ رقمی به شکل ۴-۴-۴-۴ */
function formatCard(card: string): string {
  return card.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** نمایش شبا به شکل گروه‌های ۴ رقمی برای خوانایی */
function formatSheba(sheba: string): string {
  return sheba.replace(/(.{4})(?=\S)/g, "$1 ").trim();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function faDate(iso: string): string {
  try {
    const p = jalaliParts(new Date(iso));
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

/** خواندن فایل به‌صورت data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود."));
    reader.readAsDataURL(file);
  });
}

/**
 * فشرده‌سازی خودکار عکس‌های بزرگ با canvas — همهٔ فرمت‌هایی که مرورگر
 * می‌شناسد (jpg/png/webp/gif/bmp/heic سافاری و…) پشتیبانی می‌شوند.
 */
function compressToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("فشرده‌سازی عکس ناموفق بود."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("این فایل به‌عنوان عکس خوانده نشد؛ عکس دیگری انتخاب کنید یا توضیح را بنویسید."));
    };
    img.src = url;
  });
}

/**
 * خواندن عکس رسید — همهٔ فرمت‌های عکس قابل بارگذاری‌اند؛ عکس‌های بزرگ
 * به‌صورت خودکار فشرده می‌شوند تا زیر سقف حدود ۲ مگابایت بمانند.
 * (جلسه هجدهم: آستانه فشرده‌سازی ۱٫۰۵ → ۱٫۴ مگابایت و اول تلاش برای
 * فشرده‌سازی باکیفیت ۱۹۲۰px/۰٫۹ — اگر جا نشد، ۱۶۰۰px/۰٫۸۵)
 */
async function readReceipt(file: File): Promise<string> {
  if (file.size > RECEIPT_RAW_MAX_BYTES) {
    throw new Error("حجم عکس رسید خیلی بزرگ است (حداکثر ۲۰ مگابایت).");
  }
  if (file.size <= RECEIPT_COMPRESS_THRESHOLD_BYTES) {
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("فرمت عکس رسید معتبر نیست؛ فقط فایل عکس قابل بارگذاری است.");
    }
    if (dataUrl.length <= RECEIPT_MAX_CHARS) return dataUrl;
  }
  for (const [maxDim, quality] of [
    [1920, 0.9],
    [1600, 0.85],
  ] as const) {
    const compressed = await compressToDataUrl(file, maxDim, quality);
    if (compressed.startsWith("data:image/") && compressed.length <= RECEIPT_MAX_CHARS) {
      return compressed;
    }
  }
  throw new Error("حجم عکس رسید باید کمتر از حدود ۲ مگابایت باشد؛ عکس کوچک‌تری انتخاب کنید.");
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>("shares");
  const [settings, setSettings] = useState<BankSettings | null>(null);
  const [member, setMember] = useState<BankMember | null>(null);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [installmentSub, setInstallmentSub] = useState<"unpaid" | "paid">("unpaid");
  const [copiedKey, setCopiedKey] = useState("");

  const [shareModal, setShareModal] = useState(false);
  const [shareAmount, setShareAmount] = useState("");
  const [shareReceipt, setShareReceipt] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [payModal, setPayModal] = useState<{ loan: BankLoan; row: { number: number; amount: number } } | null>(null);
  const [payReceipt, setPayReceipt] = useState("");
  const [payNote, setPayNote] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanMonths, setLoanMonths] = useState("");
  const [loanReason, setLoanReason] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [busy, setBusy] = useState(false);

  // گارد دسترسی — مهمان → /login، ادمین → /admin
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: PublicUser | null }) => {
        if (!alive) return;
        setMe(d.user ?? null);
      })
      .catch(() => {
        if (alive) setMe(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (me === null) router.replace("/login");
    else if (me && me.role === "admin") router.replace("/admin");
  }, [me, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, d, l, req] = await Promise.all([
        fetch("/api/bank/settings").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/bank/deposits").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/bank/loans").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/member/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [], loanRequests: [] })),
      ]);
      setSettings(s && typeof s === "object" ? s : null);
      setMember(Array.isArray(m) && m.length > 0 ? m[0] : null);
      setDeposits(Array.isArray(d) ? d : []);
      setLoans(Array.isArray(l) ? l : []);
      setPaymentRequests(Array.isArray(req.paymentRequests) ? req.paymentRequests : []);
      setLoanRequests(Array.isArray(req.loanRequests) ? req.loanRequests : []);
    } catch {
      setError("دریافت اطلاعات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me === undefined || me === null || me.role !== "member") return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [me, load]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  // محاسبات سهام فقط با داده واقعی (بعد از load در کلاینت)
  const shareInfo = useMemo(() => {
    if (!member || !settings) return null;
    const due = memberShareDue(member, deposits, settings.amountPerShare);
    return due;
  }, [member, settings, deposits]);

  const installmentRows = useMemo(() => {
    const rows: {
      loanId: string;
      loanLabel: string;
      number: number;
      amount: number;
      dueAt: string;
      paid: boolean;
      loanStatus: BankLoan["status"];
    }[] = [];
    loans.forEach((loan) => {
      installmentStatuses(loan).forEach((row) => {
        rows.push({
          loanId: loan.id,
          loanLabel: `وام ${faMoney(loan.principal)} تومانی`,
          number: row.number,
          amount: row.amount,
          dueAt: row.dueAt,
          paid: row.paid,
          loanStatus: loan.status,
        });
      });
    });
    rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.number - b.number);
    return rows;
  }, [loans]);

  async function submitSharePayment(event: React.FormEvent) {
    event.preventDefault();
    if (!shareReceipt && !shareNote.trim()) {
      setError("اگر عکس رسید ندارید، نوشتن توضیح پرداخت در یادداشت الزامی است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const amount = parseAmount(shareAmount);
      const response = await fetch("/api/member/share-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, receipt: shareReceipt, note: shareNote }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت پرداخت ناموفق بود.");
        return;
      }
      setShareModal(false);
      setShareAmount("");
      setShareReceipt("");
      setShareNote("");
      setNotice("پرداخت سهام ثبت شد و در انتظار تأیید مدیر است.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت پرداخت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitInstallmentPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!payModal) return;
    if (!payReceipt && !payNote.trim()) {
      setError("اگر عکس رسید ندارید، نوشتن توضیح پرداخت در یادداشت الزامی است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/member/installment-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: payModal.loan.id,
          installmentNumber: payModal.row.number,
          receipt: payReceipt,
          note: payNote,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت پرداخت ناموفق بود.");
        return;
      }
      setPayModal(null);
      setPayReceipt("");
      setPayNote("");
      setNotice("پرداخت قسط ثبت شد و در انتظار تأیید مدیر است.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت پرداخت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLoanRequest(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/member/loan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseAmount(loanAmount),
          months: Number(loanMonths),
          reason: loanReason,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت درخواست ناموفق بود.");
        return;
      }
      setLoanAmount("");
      setLoanMonths("");
      setLoanReason("");
      setNotice("درخواست تسهیلات ثبت شد و در انتظار بررسی مدیر است.");
      await load();
    } catch {
      setError("ثبت درخواست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (pwNew !== pwNew2) {
      setError("تکرار رمز جدید با رمز جدید یکسان نیست.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "تغییر رمز ناموفق بود.");
        return;
      }
      setPwCurrent("");
      setPwNew("");
      setPwNew2("");
      setNotice("رمز عبور با موفقیت عوض شد.");
    } catch {
      setError("تغییر رمز ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function pickReceipt(file: File | undefined, setter: (v: string) => void) {
    if (!file) return;
    setError("");
    try {
      setter(await readReceipt(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خواندن فایل ناموفق بود.");
    }
  }

  if (me === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black dark:text-zinc-50">
        <p className="text-sm text-zinc-500">در حال بررسی دسترسی…</p>
      </main>
    );
  }
  if (me === null || me.role !== "member") {
    return null; // در حال ریدایرکت
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-zinc-800 dark:focus:ring-primary-500/20";
  const btnPrimary =
    "rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white";
  const btnGhost =
    "rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 pb-24 dark:bg-black dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-600 text-base font-bold text-white shadow-sm dark:bg-primary-500">
              م
            </span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">پنل عضو</p>
              <h1 className="truncate text-base font-semibold">{me.fullName || me.username}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-xl border border-zinc-300 px-3 py-2 text-xs transition-colors hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:text-red-400"
          >
            خروج
          </button>
        </div>
        <div className="h-1 bg-gradient-to-l from-primary-700 via-primary-500 to-primary-400" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {notice && (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {error && !shareModal && !payModal && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {loading && <p className="text-sm text-zinc-500">در حال دریافت اطلاعات…</p>}
        {!loading && !member && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            حساب شما هنوز به عضوی از بانک متصل نشده است؛ با مدیر تماس بگیرید.
          </p>
        )}

        {tab === "shares" && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="مبلغ سهام ماهانه" value={settings ? `${faMoney(settings.amountPerShare)} تومان` : "…"} />
              <StatCard label="تعداد سهم من" value={member ? member.shares.toLocaleString("fa-IR") : "…"} />
              <StatCard label="جمع پرداخت‌شده" value={shareInfo ? `${faMoney(shareInfo.totalSharePaid)} تومان` : "…"} />
              <StatCard label="مانده تعهد" value={shareInfo ? `${faMoney(shareInfo.left)} تومان` : "…"} />
            </div>
            <button
              type="button"
              onClick={() => {
                setShareAmount(settings ? String(settings.amountPerShare * Math.max(1, member?.shares ?? 1)) : "");
                setShareReceipt("");
                setShareNote("");
                setError("");
                setShareModal(true);
              }}
              disabled={!member}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-base font-medium text-white disabled:opacity-50"
            >
              پرداخت سهام
            </button>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-2 text-sm font-medium">تاریخچه پرداخت‌های سهام من</h3>
              <div className="space-y-2">
                {paymentRequests.filter((r) => r.kind === "share").length === 0 && (
                  <p className="text-xs text-zinc-500">هنوز پرداختی ثبت نکرده‌اید.</p>
                )}
                {paymentRequests
                  .filter((r) => r.kind === "share")
                  .map((r) => (
                    <RequestRow key={r.id} title={`پرداخت سهام — ${faMoney(r.amount)} تومان`} subtitle={`${faDate(r.createdAt)}${r.note ? ` — ${r.note}` : ""}`} status={r.status} />
                  ))}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-2 text-sm font-medium">واریزی‌های تأییدشده در بانک</h3>
              <div className="space-y-2">
                {deposits.length === 0 && <p className="text-xs text-zinc-500">واریزی تأییدشده‌ای وجود ندارد.</p>}
                {deposits.map((d) => (
                  <RequestRow key={d.id} title={`${d.title} — ${faMoney(d.amount)} تومان`} subtitle={faDate(d.createdAt)} approved />
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "installments" && (
          <section className="space-y-4">
            <div className="flex gap-2">
              <SubTab active={installmentSub === "unpaid"} onClick={() => setInstallmentSub("unpaid")} label="تسویه‌نشده" count={installmentRows.filter((r) => !r.paid && r.loanStatus !== "cancelled").length} />
              <SubTab active={installmentSub === "paid"} onClick={() => setInstallmentSub("paid")} label="تسویه‌شده" count={installmentRows.filter((r) => r.paid).length} />
            </div>
            <div className="space-y-2">
              {installmentRows.filter((r) => r.paid === (installmentSub === "paid")).length === 0 && (
                <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  قسطی در این دسته وجود ندارد.
                </p>
              )}
              {installmentRows
                .filter((r) => r.paid === (installmentSub === "paid"))
                .map((row) => (
                  <div
                    key={`${row.loanId}-${row.number}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">
                        {row.loanLabel} — قسط {row.number.toLocaleString("fa-IR")}
                      </p>
                      <p className="text-xs text-zinc-500">
                        مبلغ {faMoney(row.amount)} تومان — سررسید {row.dueAt ? faDate(row.dueAt) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg px-2 py-1 text-xs ${row.paid ? STATUS_CLASS.approved : STATUS_CLASS.pending}`}>
                        {row.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}
                      </span>
                      {!row.paid && row.loanStatus !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayModal({ loan: loans.find((l) => l.id === row.loanId)!, row });
                            setPayReceipt("");
                            setPayNote("");
                            setError("");
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white"
                        >
                          پرداخت
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {tab === "loans" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-3 text-sm font-medium">درخواست تسهیلات جدید</h3>
              <form onSubmit={submitLoanRequest} className="space-y-3">
                <label className="block space-y-1 text-xs text-zinc-500">
                  مبلغ درخواستی (تومان)
                  <input value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className={inputClass} required />
                </label>
                <label className="block space-y-1 text-xs text-zinc-500">
                  مدت بازپرداخت (ماه)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={loanMonths}
                    onChange={(e) => setLoanMonths(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block space-y-1 text-xs text-zinc-500">
                  توضیحات یا دلیل درخواست
                  <textarea value={loanReason} onChange={(e) => setLoanReason(e.target.value)} rows={3} className={inputClass} />
                </label>
                <button type="submit" disabled={busy || !member} className={`${btnPrimary} w-full`}>
                  {busy ? "در حال ارسال…" : "ارسال درخواست"}
                </button>
              </form>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-2 text-sm font-medium">درخواست‌های قبلی من</h3>
              <div className="space-y-2">
                {loanRequests.length === 0 && <p className="text-xs text-zinc-500">درخواستی ثبت نکرده‌اید.</p>}
                {loanRequests.map((r) => (
                  <RequestRow
                    key={r.id}
                    title={`تسهیلات ${faMoney(r.amount)} تومانی — ${r.months.toLocaleString("fa-IR")} ماهه`}
                    subtitle={`${faDate(r.createdAt)}${r.reason ? ` — ${r.reason}` : ""}${
                      r.status === "approved"
                        ? " — تأیید نهایی شد؛ وام شما در بانک ثبت شد و اقساط آن در تب «اقساط» است."
                        : ""
                    }`}
                    status={r.status}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "deposit" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-1 text-sm font-medium">اطلاعات مالی برای واریز</h3>
              <p className="text-xs leading-6 text-zinc-500">
                مبلغ سهام یا قسط را به یکی از حساب‌های زیر واریز کنید، سپس در تب
                «سهام» یا «اقساط» با عکس رسید یا توضیح متنی ثبت کنید تا مدیر
                تأیید کند. با دکمه «کپی» می‌توانید هر مورد را کپی بگیرید.
              </p>
            </div>
            {(() => {
              const accounts = settings?.depositAccounts;
              const primary = accounts?.primary;
              const alternate = accounts?.alternate;
              const hasPrimary = Boolean(primary && (primary.holder || primary.cardNumber || primary.sheba));
              const hasAlternate = Boolean(alternate && (alternate.holder || alternate.cardNumber || alternate.sheba));
              if (!hasPrimary && !hasAlternate) {
                return (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-6 text-center text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    هنوز اطلاعات حساب توسط مدیر ثبت نشده است؛ با مدیر صندوق تماس بگیرید.
                  </p>
                );
              }
              return (
                <>
                  {hasPrimary && (
                    <AccountBlock
                      title="اطلاعات اصلی — واریز به این حساب"
                      account={primary!}
                      accent
                      copiedKey={copiedKey}
                      onCopy={async (key, text) => {
                        setCopiedKey(key);
                        setNotice((await copyText(text)) ? "کپی شد." : "کپی ناموفق بود.");
                      }}
                    />
                  )}
                  {hasAlternate && (
                    <AccountBlock
                      title="اطلاعات جایگزین — در صورت نیاز"
                      account={alternate!}
                      copiedKey={copiedKey}
                      onCopy={async (key, text) => {
                        setCopiedKey(key);
                        setNotice((await copyText(text)) ? "کپی شد." : "کپی ناموفق بود.");
                      }}
                    />
                  )}
                </>
              );
            })()}
          </section>
        )}

        {tab === "profile" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">نام و نام خانوادگی</dt>
                  <dd>{me.fullName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">نام کاربری</dt>
                  <dd dir="ltr">{me.username}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">شماره تلفن</dt>
                  <dd dir="ltr">{me.phone || "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-3 text-sm font-medium">تغییر رمز عبور</h3>
              <form onSubmit={submitChangePassword} className="space-y-3">
                <label className="block space-y-1 text-xs text-zinc-500">
                  رمز فعلی
                  <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} dir="ltr" autoComplete="current-password" className={`${inputClass} text-left`} required />
                </label>
                <label className="block space-y-1 text-xs text-zinc-500">
                  رمز جدید (حداقل ۶ نویسه)
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} dir="ltr" autoComplete="new-password" className={`${inputClass} text-left`} required />
                </label>
                <label className="block space-y-1 text-xs text-zinc-500">
                  تکرار رمز جدید
                  <input type="password" value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} dir="ltr" autoComplete="new-password" className={`${inputClass} text-left`} required />
                </label>
                <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                  {busy ? "در حال ذخیره…" : "تغییر رمز عبور"}
                </button>
              </form>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="space-y-4">
            <AppearanceSettings />
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              تنظیمات دیگر حساب (نام، رمز عبور و اطلاعات عضویت) در تب
              <strong> پروفایل </strong>
              است. تم و فونت انتخابی شما فقط روی همین دستگاه اعمال می‌شود و به
              اعضای دیگر منتقل نمی‌شود.
            </div>
          </section>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" data-noprint>
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 py-4 text-sm ${
                tab === t.key
                  ? "font-semibold text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {shareModal && (
        <Modal title="پرداخت سهام" onClose={() => setShareModal(false)}>
          <form onSubmit={submitSharePayment} className="space-y-3">
            <label className="block space-y-1 text-xs text-zinc-500">
              مبلغ پرداخت (تومان)
              <input value={shareAmount} onChange={(e) => setShareAmount(e.target.value)} className={inputClass} required />
            </label>
            <label className="block space-y-1 text-xs text-zinc-500">
              عکس رسید — اختیاری (همهٔ فرمت‌های عکس؛ عکس‌های بزرگ خودکار فشرده می‌شوند)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void pickReceipt(e.target.files?.[0], setShareReceipt)}
                className={inputClass}
              />
            </label>
            {shareReceipt && (
              <img src={shareReceipt} alt="پیش‌نمایش رسید" className="max-h-40 rounded-xl border border-zinc-200 dark:border-zinc-800" />
            )}
            <label className="block space-y-1 text-xs text-zinc-500">
              یادداشت — توضیح پرداخت (اگر عکس رسید ندارید، الزامی)
              <input value={shareNote} onChange={(e) => setShareNote(e.target.value)} className={inputClass} />
            </label>
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "در حال ارسال…" : "ثبت پرداخت"}
              </button>
              <button type="button" onClick={() => setShareModal(false)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payModal && (
        <Modal title={`پرداخت قسط ${payModal.row.number.toLocaleString("fa-IR")} — ${faMoney(payModal.row.amount)} تومان`} onClose={() => setPayModal(null)}>
          <form onSubmit={submitInstallmentPayment} className="space-y-3">
            <label className="block space-y-1 text-xs text-zinc-500">
              عکس رسید — اختیاری (همهٔ فرمت‌های عکس؛ عکس‌های بزرگ خودکار فشرده می‌شوند)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void pickReceipt(e.target.files?.[0], setPayReceipt)}
                className={inputClass}
              />
            </label>
            {payReceipt && (
              <img src={payReceipt} alt="پیش‌نمایش رسید" className="max-h-40 rounded-xl border border-zinc-200 dark:border-zinc-800" />
            )}
            <label className="block space-y-1 text-xs text-zinc-500">
              یادداشت — توضیح پرداخت (اگر عکس رسید ندارید، الزامی)
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} className={inputClass} />
            </label>
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "در حال ارسال…" : "ثبت پرداخت قسط"}
              </button>
              <button type="button" onClick={() => setPayModal(null)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-bold text-primary-700 dark:text-primary-300">{value}</p>
    </div>
  );
}

/** کارت اطلاعات یک حساب واریز: بنام + شماره کارت + شبا با دکمه کپی */
function AccountBlock({
  title,
  account,
  accent = false,
  copiedKey,
  onCopy,
}: {
  title: string;
  account: { holder: string; cardNumber: string; sheba: string };
  accent?: boolean;
  copiedKey: string;
  onCopy: (key: string, text: string) => void | Promise<void>;
}) {
  const tone = accent
    ? "border-primary-200 bg-primary-50/60 dark:border-primary-900 dark:bg-primary-950/40"
    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  const copyBtn = (key: string, text: string) => (
    <button
      type="button"
      onClick={() => void onCopy(key, text)}
      className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-primary-400 hover:text-primary-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-primary-600 dark:hover:text-primary-300"
    >
      {copiedKey === key ? "کپی شد ✓" : "کپی"}
    </button>
  );
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      {account.holder && (
        <p className="mt-2 text-sm font-semibold">به نام: {account.holder}</p>
      )}
      {account.cardNumber && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500">شماره کارت</p>
            <p dir="ltr" className="font-mono text-sm tracking-wider">
              {formatCard(account.cardNumber)}
            </p>
          </div>
          {copyBtn("card", account.cardNumber)}
        </div>
      )}
      {account.sheba && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500">شماره شبا</p>
            <p dir="ltr" className="font-mono text-xs tracking-wider">
              {formatSheba(account.sheba)}
            </p>
          </div>
          {copyBtn("sheba", account.sheba)}
        </div>
      )}
    </div>
  );
}

function SubTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-3 text-sm transition-colors ${
        active
          ? "border-primary-600 bg-primary-600 font-medium text-white dark:border-primary-500 dark:bg-primary-600"
          : "border-zinc-200 text-zinc-600 hover:border-primary-300 hover:text-primary-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-primary-700 dark:hover:text-primary-300"
      }`}
    >
      {label} ({count.toLocaleString("fa-IR")})
    </button>
  );
}

function RequestRow({ title, subtitle, status, approved }: { title: string; subtitle: string; status?: PaymentRequest["status"]; approved?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-900">
      <div className="min-w-0">
        <p className="truncate text-sm">{title}</p>
        <p className="truncate text-xs text-zinc-500">{subtitle}</p>
      </div>
      {(status || approved) && (
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${approved ? STATUS_CLASS.approved : status ? STATUS_CLASS[status] : ""}`}>
          {approved ? "تأیید شده" : status ? STATUS_LABEL[status] : ""}
        </span>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalError({ error }: { error: string }) {
  if (!error) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
}
