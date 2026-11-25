"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import type { PublicUser } from "@/lib/db";

/** نمایش اعداد به فارسی با جداکننده هزارگان */
function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

type DashboardData = {
  fund: {
    balance: number;
    totalInterest: number;
    totalShares: number;
    members: number;
    amountPerShare: number;
  };
  shareMonthlyDue: number;
  shareUnpaid: { amount: number; members: number };
  loanMonthlyDue: { amount: number; count: number; paid: number; unpaid: number };
  loanOverdue: { amount: number; count: number; loans: number };
  loanRemaining: { amount: number; loans: number };
  loanInterest: { total: number; active: number; settled: number };
  unread: {
    count: number;
    paymentCount: number;
    loanCount: number;
    lastReadAt: string;
    latest: {
      id: string;
      kind: "share" | "installment" | "loan";
      username: string;
      amount: number;
      installmentNumber: number | null;
      createdAt: string;
    }[];
  };
};

const KIND_LABEL = {
  share: "پرداخت سهام",
  installment: "پرداخت قسط",
  loan: "درخواست تسهیلات",
} as const;

/** کارت آماری داشبورد؛ variant قرمز برای تعهدات پرداخت‌نشده/باقی‌مانده */
function StatCard({
  title,
  value,
  suffix = "تومان",
  subtitle,
  variant = "default",
  href,
}: {
  title: string;
  value: number | null;
  suffix?: string;
  subtitle?: string;
  variant?: "default" | "danger" | "success";
  href?: string;
}) {
  const tone =
    variant === "danger"
      ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/60"
      : variant === "success"
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/60"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  const valueTone =
    variant === "danger"
      ? "text-red-700 dark:text-red-300"
      : variant === "success"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-primary-700 dark:text-primary-300";
  const titleTone =
    variant === "danger"
      ? "text-red-800/80 dark:text-red-300/80"
      : "text-zinc-500 dark:text-zinc-400";
  const body = (
    <>
      <p className={`text-xs font-medium ${titleTone}`}>{title}</p>
      <p className={`mt-2 text-2xl font-bold ${valueTone}`}>
        {value === null ? "…" : faMoney(value)}
        {value === null ? "" : <span className="mr-1 text-xs font-normal opacity-70">{suffix}</span>}
      </p>
      {subtitle && (
        <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      )}
    </>
  );
  const cls = `block rounded-2xl border p-5 shadow-sm transition ${tone} ${
    href ? "hover:opacity-90" : ""
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * داشبورد ادمین: موجودی کلی صندوق، تعهد ماهانه سهام، تعهدات پرداخت‌نشده سهام (قرمز)،
 * تعهدات ماهانه وام (کل سررسیدهای ماه جاری)، تعهدات باقی‌مانده وام (سررسیدشدهٔ
 * پرداخت‌نشده؛ قرمز)، سود وام و اعلان درخواست‌های خوانده‌نشده اعضا.
 */
export default function AdminDashboardPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "file" | "unknown">("unknown");

  const load = useCallback(async () => {
    try {
      const [u, d, s] = await Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/admin/dashboard").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/storage-status").then((r) =>
          r.ok ? r.json() : { mode: "unknown" },
        ),
      ]);
      setUsers(Array.isArray(u.users) ? u.users : []);
      if (d) setData(d as DashboardData);
      const mode = (s as { mode?: string }).mode;
      setStorage(mode === "supabase" || mode === "file" ? mode : "unknown");
    } catch {
      // نمایش داشبورد با مقادیر خالی بهتر از ریزش کامل است
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const fund = data?.fund;
  const unread = data?.unread;

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">داشبورد</h2>
            <p className="text-xs text-zinc-500">
              خلاصه وضعیت صندوق: موجودی، تعهدات سهام و وام و درخواست‌های خوانده‌نشده اعضا
            </p>
          </div>
        </div>

        {storage === "file" && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm leading-7 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <strong>هشدار مهم: ذخیره‌سازی دائمی فعال نیست.</strong> داده‌ها الان در
            فایل موقت سرور نگه‌داری می‌شود؛ هر بار که سرور ورکل سرد شود همه اعضا،
            کاربران و اطلاعات ثبت‌شده پاک می‌شوند و اعضا نمی‌توانند وارد شوند. برای
            رفع: دو متغیر محیطی <strong>NEXT_PUBLIC_SUPABASE_URL</strong> و
            <strong> NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> را در تنظیمات پروژه
            Vercel (تب Environment Variables) بگذارید و یک بار
            <strong> Redeploy </strong>بزنید.
          </div>
        )}
        {storage === "supabase" && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            ذخیره‌سازی دائمی (Supabase) فعال است؛ داده‌ها با سرد شدن سرور و Redeploy پاک نمی‌شوند.
          </div>
        )}

        {/* ردیف اول: موجودی صندوق + تعهدات سهام */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="موجودی کلی صندوق"
            value={loaded && fund ? fund.balance : null}
            variant="success"
            subtitle={
              fund
                ? `جمع سهم اعضا: ${faMoney(fund.totalShares)} سهم — سود ثبت‌شده: ${faMoney(fund.totalInterest)} تومان`
                : undefined
            }
          />
          <StatCard
            title="تعهد ماهانه سهام"
            value={loaded ? (data ? data.shareMonthlyDue : null) : null}
            subtitle={
              fund && fund.members > 0
                ? `جمع سهم ${faMoney(fund.members)} عضو × مبلغ هر سهم ${faMoney(fund.amountPerShare)} تومان`
                : "جمع سهم اعضا × مبلغ هر سهم"
            }
          />
          <StatCard
            title="تعهدات پرداخت‌نشده سهام"
            value={loaded ? (data ? data.shareUnpaid.amount : null) : null}
            variant="danger"
            subtitle={
              data && data.shareUnpaid.members > 0
                ? `${faMoney(data.shareUnpaid.members)} عضو تعهد این ماه را کامل نپرداخته‌اند`
                : "همه اعضا تعهد سهام این ماه را پرداخته‌اند"
            }
          />
        </div>

        {/* ردیف دوم: تعهدات وام + اعلان درخواست‌ها */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="تعهدات ماهانه وام"
            value={loaded ? (data ? data.loanMonthlyDue.amount : null) : null}
            subtitle={
              data && data.loanMonthlyDue.count > 0
                ? `${faMoney(data.loanMonthlyDue.count)} قسط سررسید این ماه دارد — پرداخت‌شده: ${faMoney(data.loanMonthlyDue.paid)} تومان، پرداخت‌نشده: ${faMoney(data.loanMonthlyDue.unpaid)} تومان`
                : "هیچ قسطی سررسید این ماه ندارد"
            }
          />
          <StatCard
            title="تعهدات باقی‌مانده وام"
            value={loaded ? (data ? data.loanOverdue.amount : null) : null}
            variant="danger"
            subtitle={
              data
                ? data.loanOverdue.count > 0
                  ? `${faMoney(data.loanOverdue.count)} قسط از ${faMoney(data.loanOverdue.loans)} وام سررسیدشده و پرداخت‌نشده است — مانده کل اقساط همه وام‌ها: ${faMoney(data.loanRemaining.amount)} تومان`
                  : `هیچ قسط سررسیدشده پرداخت‌نشده‌ای وجود ندارد — مانده کل اقساط همه وام‌ها: ${faMoney(data.loanRemaining.amount)} تومان`
                : undefined
            }
          />
          <StatCard
            title="سود وام"
            value={loaded ? (data ? data.loanInterest.total : null) : null}
            subtitle={
              data
                ? `در جریان: ${faMoney(data.loanInterest.active)} تومان — تسویه‌شده: ${faMoney(data.loanInterest.settled)} تومان`
                : undefined
            }
          />
          <Link
            href="/admin/requests"
            className={`block rounded-2xl border p-5 shadow-sm transition hover:opacity-90 ${
              unread && unread.count > 0
                ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/60"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                درخواست‌های خوانده‌نشده
              </p>
              <span className="relative inline-flex">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`size-5 ${
                    unread && unread.count > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread && unread.count > 0 && (
                  <span className="absolute -left-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {faMoney(unread.count)}
                  </span>
                )}
              </span>
            </div>
            <p
              className={`mt-2 text-2xl font-bold ${
                unread && unread.count > 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-primary-700 dark:text-primary-300"
              }`}
            >
              {loaded ? (unread ? faMoney(unread.count) : "…") : "…"}
              <span className="mr-1 text-xs font-normal opacity-70">درخواست</span>
            </p>
            {unread && unread.count > 0 ? (
              <div className="mt-3 space-y-1.5">
                {unread.latest.map((item) => (
                  <p
                    key={item.id}
                    className="truncate rounded-lg bg-red-100/70 px-2 py-1 text-[11px] text-red-800 dark:bg-red-900/50 dark:text-red-200"
                  >
                    {KIND_LABEL[item.kind]}
                    {item.kind === "installment" && item.installmentNumber
                      ? ` ${faMoney(item.installmentNumber)}`
                      : ""}{" "}
                    — {faMoney(item.amount)} تومان — {item.username}
                  </p>
                ))}
                <p className="text-[11px] font-medium text-red-700 dark:text-red-300">
                  برای مشاهده و بررسی کلیک کنید
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                درخواست جدیدی برای بررسی وجود ندارد؛ درخواست‌های جدید اعضا با اعلان همین‌جا مشخص می‌شوند.
              </p>
            )}
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p>
            برای اینکه عضو بتواند وارد شود: عضو مالی را در
            <strong> فم بانک ← تب اعضا </strong>
            ثبت کنید، بعد روی کارت او دکمه
            <strong> «حساب ورود» </strong>
            را بزنید و نام کاربری و رمز بسازید؛ همان نام کاربری و رمز را برای عضو
            بفرستید تا از صفحه ورود داخل شود. (یا از بخش
            <strong> مدیریت کاربران </strong>
            با «اتصال به عضو بانک» حساب بسازید.)
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            یادآوری: اگر هنوز رمز پیش‌فرض ادمین را عوض نکرده‌اید، از صفحه پروفایل
            خودتان (بخش مدیریت کاربران → تغییر رمز) آن را تغییر دهید.
          </p>
          {users.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              کاربران فعلی: {faMoney(users.length)} — غیرفعال:{" "}
              {faMoney(users.filter((u) => !u.active).length)}
            </p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
