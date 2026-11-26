"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import ClayIcon, { toneForIcon, type ClayIconName, type ClayTone } from "@/app/components/mobile/ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { PublicUser } from "@/lib/db";

/** نمایش اعداد به فارسی با جداکننده هزارگان */
function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

/** تاریخ شمسی کوتاه برای نمایش سررسید اقساط (جلسه ۳۸) */
function faDate(iso: string): string {
  try {
    const p = jalaliParts(new Date(iso));
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  } catch {
    return "—";
  }
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
  shareUnpaid: {
    amount: number;
    members: number;
    // جلسه ۳۸: مشخصات هر عضو پرداخت‌نکرده برای نمایش در اعلان و کارت جزئیات
    details: { memberId: string; name: string; shares: number; monthlyDue: number; left: number }[];
  };
  // جلسه ۳۸: مهلت پرداخت سهام = روز ۵ هر ماه شمسی
  shareDeadline: { day: number; daysLeft: number; past: boolean };
  loanMonthlyDue: { amount: number; count: number; paid: number; unpaid: number };
  loanOverdue: {
    amount: number;
    count: number;
    loans: number;
    // جلسه ۳۸: مشخصات تک‌تک اقساط سررسیدشده و پرداخت‌نشده
    details: { loanId: string; memberName: string; principal: number; number: number; amount: number; dueAt: string }[];
  };
  loanRemaining: { amount: number; loans: number };
  loanInterest: { total: number; active: number; settled: number };
  unread: {
    count: number;
    paymentCount: number;
    loanCount: number;
    lastReadAt: string;
    latest: {
      id: string;
      kind: "share" | "installment" | "loan" | "payout";
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
  // جلسه ۳۷: ارسال شبا/کارت عضو برای واریز تسهیلات در زنگ ادمین
  payout: "ارسال حساب واریز تسهیلات",
} as const;

type TileVariant = "default" | "danger" | "warning";

/** رنگ لُه سفالی آیکون هر مربع بر اساس حالت */
const TILE_ICON_TONE: Record<TileVariant, ClayTone | undefined> = {
  default: undefined,
  danger: ["#FCA9A9", "#D95050"],
  warning: ["#FFE08E", "#E8A62B"],
};

type TileKey =
  | "unread"
  | "shareMonthlyDue"
  | "shareUnpaid"
  | "loanMonthlyDue"
  | "loanOverdue"
  | "loanRemaining"
  | "loanInterest"
  | "totalShares"
  | "totalInterest"
  | "members";

/**
 * مربع‌های سه‌بعدی داشبورد ادمین — فقط آیکون و عنوان؛ هیچ عددی روی مربع‌ها
 * دیده نمی‌شود و اطلاعات هر مربع فقط بعد از لمس آن در کارت جزئیات نمایش
 * داده می‌شود (جلسه ۲۶ مرحله ۵).
 */
const TILES: { key: TileKey; label: string; icon: ClayIconName; variant?: TileVariant }[] = [
  { key: "unread", label: "درخواست‌های خوانده‌نشده", icon: "bell" },
  { key: "shareMonthlyDue", label: "تعهد ماهانه سهام", icon: "coins" },
  { key: "shareUnpaid", label: "تعهدات پرداخت‌نشده سهام", icon: "clock", variant: "danger" },
  { key: "loanMonthlyDue", label: "تعهدات ماهانه وام", icon: "calendar" },
  { key: "loanOverdue", label: "تعهدات باقی‌مانده وام", icon: "history", variant: "danger" },
  { key: "loanRemaining", label: "مانده اقساط وام‌ها", icon: "wallet" },
  { key: "loanInterest", label: "سود وام", icon: "banknote" },
  { key: "totalShares", label: "جمع سهم اعضا", icon: "deposit" },
  { key: "totalInterest", label: "سود ثبت‌شده", icon: "chart" },
  { key: "members", label: "اعضا", icon: "users" },
];

/** مربع آماری سه‌بعدی — هم‌سبک با مربع‌های خانه پوسته یوزر (aspect-square + clay).
 *  جلسه ۳۳: تینت پاستلی هماهنگ با رنگ آیکون (مثل مربع‌های یوزر)؛ حالت‌های
 *  خطر/هشدار رنگ معنایی قرمز/کهربایی خودشان را نگه می‌دارند */
function StatTile({
  label,
  icon,
  variant = "default",
  active,
  pulse,
  onClick,
}: {
  label: string;
  icon: ClayIconName;
  variant?: TileVariant;
  active: boolean;
  pulse?: boolean;
  onClick: () => void;
}) {
  const tone =
    variant === "danger"
      ? "border-red-200/80 bg-red-50/80 dark:border-red-900 dark:bg-red-950/60"
      : variant === "warning"
        ? "border-amber-200/80 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/60"
        : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  const tint = variant === "default" ? toneForIcon(icon) : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={tint ? { backgroundImage: `linear-gradient(145deg, ${tint[0]}33 0%, ${tint[1]}1a 55%, transparent 100%)` } : undefined}
      className={`clay-press relative flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border p-2 shadow-sm transition hover:opacity-90 ${tone} ${
        active ? "border-primary-400 ring-2 ring-primary-500/60 dark:border-primary-600" : ""
      }`}
    >
      <ClayIcon name={icon} size={42} tone={TILE_ICON_TONE[variant]} />
      <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">
        {label}
      </span>
      {pulse && (
        <span className="absolute left-2.5 top-2.5 size-2.5 animate-pulse rounded-full bg-red-500" />
      )}
    </button>
  );
}

/** جزئیات لمس‌شده هر مربع — مقدار، توضیح و لیست ردیف‌های متنی (اعلان‌ها/معوق‌ها) */
type DetailSpec = {
  title: string;
  icon: ClayIconName;
  variant: TileVariant;
  value: number | null;
  suffix: string;
  subtitle?: string;
  list?: string[];
  href?: string;
  hrefLabel?: string;
};

/** حاشیه/پس‌زمینه کارت جزئیات بر اساس حالت مربع لمس‌شده */
function detailTone(variant: TileVariant): string {
  return variant === "danger"
    ? "border-red-200/80 bg-red-50/80 dark:border-red-900 dark:bg-red-950/60"
    : variant === "warning"
      ? "border-amber-200/80 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/60"
      : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950";
}

/**
 * جلسه ۳۸ — بنر اعلان مهلت‌ها در داشبورد ادمین:
 * - سهام: مهلت تا روز ۵ هر ماه؛ اگر گذشت و اعضایی پرداخت نکرده باشند قرمز می‌شود
 * - وام: اقساط سررسیدشدهٔ پرداخت‌نشده همیشه قرمز است
 * مشخصات هر مورد در ردیف‌های زیر بنر نمایش داده می‌شود (حداکثر ۶ ردیف + شمارنده).
 */
function DeadlineBanner({
  variant,
  title,
  subtitle,
  rows,
  more,
  href,
  hrefLabel,
}: {
  variant: "danger" | "warning";
  title: string;
  subtitle: string;
  rows?: string[];
  more?: number;
  href?: string;
  hrefLabel?: string;
}) {
  const tone =
    variant === "danger"
      ? "border-red-300/80 bg-red-50/90 dark:border-red-900 dark:bg-red-950/50"
      : "border-amber-300/80 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/50";
  const textTone =
    variant === "danger"
      ? "text-red-800 dark:text-red-300"
      : "text-amber-800 dark:text-amber-300";
  const rowTone =
    variant === "danger"
      ? "bg-red-100/80 text-red-900 dark:bg-red-950/70 dark:text-red-200"
      : "bg-amber-100/80 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200";
  return (
    <div className={`max-w-2xl rounded-3xl border p-4 shadow-sm ${tone}`}>
      <div className="flex items-start gap-3">
        <ClayIcon
          name="bell"
          size={38}
          tone={variant === "danger" ? ["#FCA9A9", "#D95050"] : ["#FFE08E", "#E8A62B"]}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold leading-6 ${textTone}`}>{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{subtitle}</p>
          {rows && rows.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {rows.map((row, i) => (
                <p
                  key={i}
                  className={`rounded-2xl px-3 py-1.5 text-[11px] leading-5 ${rowTone}`}
                >
                  {row}
                </p>
              ))}
              {more && more > 0 && (
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  و {faMoney(more)} مورد دیگر…
                </p>
              )}
            </div>
          )}
          {href && hrefLabel && (
            <Link
              href={href}
              className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-primary-700"
            >
              {hrefLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function detailValueTone(variant: TileVariant): string {
  return variant === "danger"
    ? "text-red-700 dark:text-red-300"
    : variant === "warning"
      ? "text-amber-700 dark:text-amber-300"
      : "text-primary-700 dark:text-primary-300";
}

/**
 * داشبورد ادمین — هیرو گرادیان سرمه‌ای با موجودی بانک + مربع‌های سه‌بعدی
 * آماری که اعدادشان فقط بعد از لمس دیده می‌شود + اعلان درخواست‌های خوانده‌نشده.
 */
export default function AdminDashboardPage() {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "file" | "unknown">("unknown");
  /** مربع لمس‌شده — جزئیاتش در کارت زیر شبکه مربع‌ها دیده می‌شود */
  const [openTile, setOpenTile] = useState<TileKey | null>(null);

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

  function toggleTile(key: TileKey) {
    setOpenTile((cur) => (cur === key ? null : key));
  }

  /** ساخت جزئیات مربع لمس‌شده از داده واقعی داشبورد — value = null یعنی در حال بارگذاری */
  const detail: DetailSpec | null = (() => {
    if (!openTile) return null;
    switch (openTile) {
      case "unread": {
        const has = !!unread && unread.count > 0;
        return {
          title: "درخواست‌های خوانده‌نشده",
          icon: "bell",
          variant: has ? "warning" : "default",
          value: loaded ? (unread ? unread.count : 0) : null,
          suffix: "درخواست",
          subtitle: has
            ? undefined
            : "درخواست جدیدی برای بررسی وجود ندارد؛ درخواست‌های جدید اعضا با اعلان همین مربع مشخص می‌شوند.",
          list: has
            ? unread!.latest.map(
                (item) =>
                  `${KIND_LABEL[item.kind]}${
                    item.kind === "installment" && item.installmentNumber
                      ? ` ${faMoney(item.installmentNumber)}`
                      : ""
                  } — ${faMoney(item.amount)} تومان — ${item.username}`,
              )
            : undefined,
          href: has ? "/admin/requests" : undefined,
          hrefLabel: "بررسی درخواست‌ها",
        };
      }
      case "shareMonthlyDue":
        return {
          title: "تعهد ماهانه سهام",
          icon: "coins",
          variant: "default",
          value: loaded && data ? data.shareMonthlyDue : null,
          suffix: "تومان",
          subtitle:
            fund && fund.members > 0
              ? `جمع سهم ${faMoney(fund.members)} عضو × مبلغ هر سهم ${faMoney(fund.amountPerShare)} تومان`
              : "جمع سهم اعضا × مبلغ هر سهم",
        };
      case "shareUnpaid": {
        const has = !!data && data.shareUnpaid.members > 0;
        const past = !!data && data.shareDeadline.past;
        return {
          title: "تعهدات پرداخت‌نشده سهام",
          icon: "clock",
          variant: "danger",
          value: loaded && data ? data.shareUnpaid.amount : null,
          suffix: "تومان",
          subtitle:
            data && has
              ? `${faMoney(data.shareUnpaid.members)} عضو تعهد این ماه را کامل نپرداخته‌اند — مهلت تا روز ۵ ماه${past ? " (گذشته است)" : data.shareDeadline.daysLeft === 0 ? " — امروز آخرین روز" : ` — ${faMoney(data.shareDeadline.daysLeft)} روز مانده`}`
              : "همه اعضا تعهد سهام این ماه را پرداخته‌اند",
          list: has
            ? data!.shareUnpaid.details.slice(0, 8).map((d) =>
                `${d.name} — ${faMoney(d.shares)} سهم — مانده ${faMoney(d.left)} تومان`,
              )
            : undefined,
          href: has ? "/bank" : undefined,
          hrefLabel: "مدیریت سهام اعضا",
        };
      }
      case "loanMonthlyDue":
        return {
          title: "تعهدات ماهانه وام",
          icon: "calendar",
          variant: "default",
          value: loaded && data ? data.loanMonthlyDue.amount : null,
          suffix: "تومان",
          subtitle:
            data && data.loanMonthlyDue.count > 0
              ? `${faMoney(data.loanMonthlyDue.count)} قسط سررسید این ماه دارد — پرداخت‌شده: ${faMoney(data.loanMonthlyDue.paid)} تومان، پرداخت‌نشده: ${faMoney(data.loanMonthlyDue.unpaid)} تومان`
              : "هیچ قسطی سررسید این ماه ندارد",
        };
      case "loanOverdue": {
        const has = !!data && data.loanOverdue.count > 0;
        return {
          title: "تعهدات باقی‌مانده وام",
          icon: "history",
          variant: "danger",
          value: loaded && data ? data.loanOverdue.amount : null,
          suffix: "تومان",
          subtitle: data
            ? has
              ? `${faMoney(data.loanOverdue.count)} قسط از ${faMoney(data.loanOverdue.loans)} وام سررسیدشده و پرداخت‌نشده است — مشخصات هر قسط در ادامه`
              : "هیچ قسط سررسیدشده پرداخت‌نشده‌ای وجود ندارد"
            : undefined,
          list: has
            ? data!.loanOverdue.details.slice(0, 8).map((d) =>
                `${d.memberName} — وام ${faMoney(d.principal)} تومانی — قسط ${faMoney(d.number)} — ${faMoney(d.amount)} تومان — سررسید ${faDate(d.dueAt)}`,
              )
            : undefined,
          href: has ? "/bank" : undefined,
          hrefLabel: "مدیریت وام‌ها",
        };
      }
      case "loanRemaining":
        return {
          title: "مانده اقساط وام‌ها",
          icon: "wallet",
          variant: "default",
          value: loaded && data ? data.loanRemaining.amount : null,
          suffix: "تومان",
          subtitle: data
            ? `جمع اقساط پرداخت‌نشده همه وام‌ها — وام در جریان: ${faMoney(data.loanRemaining.loans)}`
            : undefined,
        };
      case "loanInterest":
        return {
          title: "سود وام",
          icon: "banknote",
          variant: "default",
          value: loaded && data ? data.loanInterest.total : null,
          suffix: "تومان",
          subtitle: data
            ? `در جریان: ${faMoney(data.loanInterest.active)} تومان — تسویه‌شده: ${faMoney(data.loanInterest.settled)} تومان`
            : undefined,
        };
      case "totalShares":
        return {
          title: "جمع سهم اعضا",
          icon: "deposit",
          variant: "default",
          value: loaded && fund ? fund.totalShares : null,
          suffix: "سهم",
          subtitle: "جمع تعداد سهم همه اعضای ثبت‌شده در بانک",
        };
      case "totalInterest":
        return {
          title: "سود ثبت‌شده",
          icon: "chart",
          variant: "default",
          value: loaded && fund ? fund.totalInterest : null,
          suffix: "تومان",
          subtitle: "سود وام‌های تسویه‌شده + واریزی‌های سود ثبت‌شده اعضا",
        };
      case "members":
        return {
          title: "اعضا",
          icon: "users",
          variant: "default",
          value: loaded && fund ? fund.members : null,
          suffix: "نفر",
          subtitle: "تعداد اعضای ثبت‌شده در بانک",
        };
    }
  })();

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* هیرو گرادیان موجودی بانک — هم‌سبک با هدر تراکنش‌ها و خانه مدیر در پوسته یوزر
            (جلسه ۳۳: یک درجه روشن‌تر + درخشش‌های رنگی پالت لوگو) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary-600 via-primary-700 to-primary-900 p-4 text-white shadow-lg shadow-primary-800/30 sm:p-5">
          {/* درخشش‌های تزئینی — جلسه ۳۵: radial-gradient به‌جای blur زنده (سرعت اسکرول) */}
          <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 size-36 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.2), transparent)" }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 left-16 size-44 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(125,211,252,0.2), transparent)" }} />
          <div aria-hidden className="pointer-events-none absolute -top-10 right-1/4 size-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(186,230,253,0.15), transparent)" }} />
          <div className="relative">
            <p className="text-xs text-white/70">سلام، {name}</p>
            <p className="mt-1 text-sm font-medium text-white/90">موجودی کلی بانک</p>
            <p className="mt-1 text-2xl font-black leading-8 tracking-tight">
              {loaded && fund ? (
                <>
                  {faMoney(fund.balance)} <span className="text-base font-bold text-white/80">تومان</span>
                </>
              ) : (
                "…"
              )}
            </p>
          </div>
        </div>

        {/* اعلان‌های مهلت — جلسه ۳۸: سهام تا روز ۵ ماه؛ اقساط معوق همیشه قرمز */}
        {data && data.shareUnpaid.members > 0 && (
          <DeadlineBanner
            variant={data.shareDeadline.past ? "danger" : "warning"}
            title={
              data.shareDeadline.past
                ? "مهلت پرداخت سهام (تا روز ۵ ماه) گذشته است"
                : data.shareDeadline.daysLeft === 0
                  ? "امروز روز ۵ ماه است — آخرین مهلت پرداخت سهام"
                  : `مهلت پرداخت سهام تا روز ۵ ماه — ${faMoney(data.shareDeadline.daysLeft)} روز مانده`
            }
            subtitle={`${faMoney(data.shareUnpaid.members)} عضو تعهد سهام این ماه را کامل نپرداخته‌اند — جمع مانده: ${faMoney(data.shareUnpaid.amount)} تومان`}
            rows={data.shareUnpaid.details.slice(0, 6).map(
              (d) => `${d.name} — ${faMoney(d.shares)} سهم — مانده ${faMoney(d.left)} تومان`,
            )}
            more={Math.max(0, data.shareUnpaid.details.length - 6)}
            href="/bank"
            hrefLabel="مدیریت سهام اعضا"
          />
        )}
        {data && data.loanOverdue.count > 0 && (
          <DeadlineBanner
            variant="danger"
            title="اقساط سررسیدشده و پرداخت‌نشده — تعهدات باقی‌مانده وام"
            subtitle={`${faMoney(data.loanOverdue.count)} قسط از ${faMoney(data.loanOverdue.loans)} وام سررسیدشده و پرداخت‌نشده است — جمع: ${faMoney(data.loanOverdue.amount)} تومان`}
            rows={data.loanOverdue.details.slice(0, 6).map(
              (d) => `${d.memberName} — وام ${faMoney(d.principal)} تومانی — قسط ${faMoney(d.number)} — ${faMoney(d.amount)} تومان — سررسید ${faDate(d.dueAt)}`,
            )}
            more={Math.max(0, data.loanOverdue.details.length - 6)}
            href="/bank"
            hrefLabel="مدیریت وام‌ها"
          />
        )}

        {storage === "file" && (
          <div className="max-w-3xl rounded-3xl border border-red-200/80 bg-red-50/80 p-4 text-sm leading-7 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
          <div className="flex max-w-3xl items-center gap-2.5 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <ClayIcon name="check" size={30} ghost ghostColor="currentColor" />
            ذخیره‌سازی دائمی (Supabase) فعال است؛ داده‌ها با سرد شدن سرور و Redeploy پاک نمی‌شوند.
          </div>
        )}

        {/* مربع‌های سه‌بعدی آماری — بدون عدد؛ اطلاعات هر مربع فقط با لمس آن */}
        <section className="max-w-2xl space-y-3">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {TILES.map((t) => (
              <StatTile
                key={t.key}
                label={t.label}
                icon={t.icon}
                variant={t.variant}
                active={openTile === t.key}
                pulse={
                  (t.key === "unread" && !!unread && unread.count > 0) ||
                  // جلسه ۳۸: اعلان پالس روی مربع معوق‌ها — سهام تا روز ۵ / اقساط سررسیدشده
                  (t.key === "shareUnpaid" && !!data && data.shareUnpaid.members > 0) ||
                  (t.key === "loanOverdue" && !!data && data.loanOverdue.count > 0)
                }
                onClick={() => toggleTile(t.key)}
              />
            ))}
          </div>
          <p className="text-center text-[11px] leading-6 text-zinc-400">
            برای دیدن اطلاعات هر مربع، آن را لمس کنید.
          </p>
        </section>

        {/* کارت جزئیات — فقط بعد از لمس مربع مربوطه */}
        {detail && (
          <div className={`max-w-2xl rounded-3xl border p-4 shadow-sm ${detailTone(detail.variant)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <ClayIcon name={detail.icon} size={40} tone={TILE_ICON_TONE[detail.variant]} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{detail.title}</p>
                  <p className={`mt-1 text-xl font-bold ${detailValueTone(detail.variant)}`}>
                    {detail.value === null ? "…" : faMoney(detail.value)}
                    {detail.value === null ? "" : (
                      <span className="mr-1 text-xs font-normal opacity-70">{detail.suffix}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenTile(null)}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                بستن
              </button>
            </div>
            {detail.subtitle && (
              <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{detail.subtitle}</p>
            )}
            {detail.list && detail.list.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {detail.list.map((row, i) => (
                  <p
                    key={i}
                    className="truncate rounded-2xl bg-amber-100/70 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    {row}
                  </p>
                ))}
              </div>
            )}
            {detail.href && (
              <Link
                href={detail.href}
                className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-primary-700"
              >
                {detail.hrefLabel}
              </Link>
            )}
          </div>
        )}

        <div className="flex max-w-3xl items-start gap-3 rounded-3xl border border-zinc-200/80 bg-white p-4 text-sm leading-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
