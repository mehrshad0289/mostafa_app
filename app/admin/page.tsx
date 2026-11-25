"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import ClayIcon, { type ClayIconName, type ClayTone } from "@/app/components/mobile/ClayIcon";
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

/** آیکون سفالی هر کارت آماری — هم‌سبک با آیکون‌های پوسته یوزر */
const CARD_ICON: ClayIconName = "wallet";

type StatVariant = "default" | "danger" | "success";

const CARD_TONE_BY_VARIANT: Record<StatVariant, ClayTone> = {
  default: ["#9CC6FF", "#4C82E0"],
  danger: ["#FCA9A9", "#D95050"],
  success: ["#B5EBA5", "#54B854"],
};

/** کارت آماری داشبورد با آیکون سفالی؛ variant قرمز برای تعهدات پرداخت‌نشده/باقی‌مانده */
function StatCard({
  title,
  value,
  suffix = "تومان",
  subtitle,
  variant = "default",
  icon = CARD_ICON,
  href,
}: {
  title: string;
  value: number | null;
  suffix?: string;
  subtitle?: string;
  variant?: StatVariant;
  icon?: ClayIconName;
  href?: string;
}) {
  const tone =
    variant === "danger"
      ? "border-red-200/80 bg-red-50/80 dark:border-red-900 dark:bg-red-950/60"
      : variant === "success"
        ? "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/60"
        : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950";
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
  const cls = `block rounded-3xl border p-5 shadow-sm transition ${tone} ${
    href ? "clay-press hover:opacity-90" : ""
  }`;
  const withIcon = (inner: React.ReactNode) => (
    <div className="flex items-start gap-3">
      <ClayIcon name={icon} tone={CARD_TONE_BY_VARIANT[variant]} size={44} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{inner}</div>
    </div>
  );
  return href ? (
    <Link href={href} className={cls}>
      {withIcon(body)}
    </Link>
  ) : (
    <div className={cls}>{withIcon(body)}</div>
  );
}

/**
 * داشبورد ادمین — هم‌سبک با پوسته یوزر: هیرو گرادیان سرمه‌ای با موجودی صندوق +
 * کارت‌های آماری با آیکون‌های سفالی + اعلان درخواست‌های خوانده‌نشده.
 */
export default function AdminDashboardPage() {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "file" | "unknown">("unknown");

  const load = useCallback(async () => {
    try {
      const [u, d, s, m] = await Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/admin/dashboard").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/storage-status").then((r) =>
          r.ok ? r.json() : { mode: "unknown" },
        ),
        fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
      ]);
      setUsers(Array.isArray(u.users) ? u.users : []);
      if (d) setData(d as DashboardData);
      const mode = (s as { mode?: string }).mode;
      setStorage(mode === "supabase" || mode === "file" ? mode : "unknown");
      setMe((m.user as PublicUser | null) ?? null);
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
  const name = me?.fullName || me?.username || "مدیر";

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* هیرو گرادیان موجودی صندوق — هم‌سبک با هدر تراکنش‌ها و خانه مدیر در پوسته یوزر */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary-700 via-primary-800 to-primary-950 p-5 text-white shadow-lg shadow-primary-900/30">
          <div className="pointer-events-none absolute -left-10 -top-10 size-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-16 left-16 size-44 rounded-full bg-white/5" />
          <div className="relative">
            <p className="text-xs text-white/70">سلام، {name}</p>
            <p className="mt-1 text-sm font-medium text-white/90">موجودی کلی صندوق</p>
            <p className="mt-1 text-[27px] font-black leading-9 tracking-tight">
              {loaded && fund ? (
                <>
                  {faMoney(fund.balance)} <span className="text-base font-bold text-white/80">تومان</span>
                </>
              ) : (
                "…"
              )}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <p className="text-white/60">جمع سهم اعضا</p>
                <p className="mt-0.5 font-bold">{fund ? faMoney(fund.totalShares) : "…"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <p className="text-white/60">سود ثبت‌شده</p>
                <p className="mt-0.5 font-bold">{fund ? faMoney(fund.totalInterest) : "…"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <p className="text-white/60">اعضا</p>
                <p className="mt-0.5 font-bold">{fund ? faMoney(fund.members) : "…"}</p>
              </div>
            </div>
          </div>
        </div>

        {storage === "file" && (
          <div className="rounded-3xl border border-red-200/80 bg-red-50/80 p-4 text-sm leading-7 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
          <div className="flex items-center gap-2.5 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <ClayIcon name="check" size={30} ghost ghostColor="currentColor" />
            ذخیره‌سازی دائمی (Supabase) فعال است؛ داده‌ها با سرد شدن سرور و Redeploy پاک نمی‌شوند.
          </div>
        )}

        {/* ردیف اول: تعهدات سهام */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="تعهد ماهانه سهام"
            value={loaded ? (data ? data.shareMonthlyDue : null) : null}
            icon="coins"
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
            icon="clock"
            subtitle={
              data && data.shareUnpaid.members > 0
                ? `${faMoney(data.shareUnpaid.members)} عضو تعهد این ماه را کامل نپرداخته‌اند`
                : "همه اعضا تعهد سهام این ماه را پرداخته‌اند"
            }
          />
          <StatCard
            title="سود وام"
            value={loaded ? (data ? data.loanInterest.total : null) : null}
            icon="chart"
            subtitle={
              data
                ? `در جریان: ${faMoney(data.loanInterest.active)} تومان — تسویه‌شده: ${faMoney(data.loanInterest.settled)} تومان`
                : undefined
            }
          />
        </div>

        {/* ردیف دوم: تعهدات وام */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            title="تعهدات ماهانه وام"
            value={loaded ? (data ? data.loanMonthlyDue.amount : null) : null}
            icon="calendar"
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
            icon="history"
            subtitle={
              data
                ? data.loanOverdue.count > 0
                  ? `${faMoney(data.loanOverdue.count)} قسط از ${faMoney(data.loanOverdue.loans)} وام سررسیدشده و پرداخت‌نشده است — مانده کل اقساط همه وام‌ها: ${faMoney(data.loanRemaining.amount)} تومان`
                  : `هیچ قسط سررسیدشده پرداخت‌نشده‌ای وجود ندارد — مانده کل اقساط همه وام‌ها: ${faMoney(data.loanRemaining.amount)} تومان`
                : undefined
            }
          />
        </div>

        {/* اعلان درخواست‌های خوانده‌نشده */}
        <Link
          href="/admin/requests"
          className={`clay-press block rounded-3xl border p-5 shadow-sm transition hover:opacity-95 ${
            unread && unread.count > 0
              ? "border-red-200/80 bg-red-50/80 dark:border-red-900 dark:bg-red-950/60"
              : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ClayIcon name="bell" size={44} tone={unread && unread.count > 0 ? ["#FFE08E", "#E8A62B"] : undefined} />
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  درخواست‌های خوانده‌نشده
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    unread && unread.count > 0
                      ? "text-red-700 dark:text-red-300"
                      : "text-primary-700 dark:text-primary-300"
                  }`}
                >
                  {loaded ? (unread ? faMoney(unread.count) : "…") : "…"}
                  <span className="mr-1 text-xs font-normal opacity-70">درخواست</span>
                </p>
              </div>
            </div>
            {unread && unread.count > 0 && (
              <span className="relative inline-flex">
                <span className="absolute -left-1 -top-1 size-2.5 animate-pulse rounded-full bg-red-500" />
              </span>
            )}
          </div>
          {unread && unread.count > 0 ? (
            <div className="mt-3 space-y-1.5">
              {unread.latest.map((item) => (
                <p
                  key={item.id}
                  className="truncate rounded-2xl bg-red-100/70 px-3 py-1.5 text-[11px] text-red-800 dark:bg-red-900/50 dark:text-red-200"
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

        <div className="flex items-start gap-3 rounded-3xl border border-zinc-200/80 bg-white p-5 text-sm leading-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="info" size={40} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
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
      </div>
    </AdminShell>
  );
}
