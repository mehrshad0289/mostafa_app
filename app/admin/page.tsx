"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import ClayIcon, { toneForIcon, type ClayIconName, type ClayTone } from "@/app/components/mobile/ClayIcon";
import { useAlertDismissed, useAlertSetVisible } from "@/app/components/useAlertDismiss";
import { jalaliParts } from "@/lib/bank";

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
  shareDeadline: { day: number; daysLeft: number; past: boolean; ym: string };
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
  onClose,
}: {
  variant: "danger" | "warning";
  title: string;
  subtitle: string;
  rows?: string[];
  more?: number;
  href?: string;
  hrefLabel?: string;
  /** جلسه ۴۰: اگر داده شود دکمهٔ × در گوشهٔ بنر می‌آید و اعلان بسته می‌شود */
  onClose?: () => void;
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
    <div className={`relative max-w-2xl rounded-3xl border p-4 shadow-sm ${tone}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن این اعلان"
          title="بستن — تا دورهٔ بعد نشان داده نمی‌شود"
          className={`absolute left-3 top-3 grid size-7 place-items-center rounded-full text-base leading-none opacity-60 transition hover:bg-black/10 hover:opacity-100 ${textTone}`}
        >
          ×
        </button>
      )}
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
 * داشبورد ادمین — جلسه ۶۰: هیرو تصویری خوش‌آمدگویی طبق طراحی PDF + ۴ کارت آماری
 * (اعضا / موجودی صندوق / واریزی‌ها / تسهیلات) + مربع‌های سه‌بعدی لمسی + اعلان‌ها.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "file" | "unknown">("unknown");
  /** جلسه ۶۰ — کارت‌های آماری خانهٔ مدیر: کل واریزی‌ها (جمع مبلغ همهٔ رکوردها)
   *  و کل تسهیلات پرداختی (جمع مبلغ پرداخت‌شده وام‌ها) */
  const [money, setMoney] = useState<{ deposits: number; loans: number } | null>(null);
  /** مربع لمس‌شده — جزئیاتش در کارت زیر شبکه مربع‌ها دیده می‌شود */
  const [openTile, setOpenTile] = useState<TileKey | null>(null);

  /**
   * جلسه ۴۰ — بستن اعلان‌های سررسید داشبورد (ذخیره در localStorage همین دستگاه؛
   * ماه شمسی از سرور در shareDeadline.ym می‌آید تا prerender به تاریخ نیفتد).
   * سهام: کلید ماهانه — با ماه جدید دوباره باز می‌شود. اقساط معوق: مجموعه‌ای —
   * قسط معوقِ جدید بنر را دوباره باز می‌کند، پرداخت بخشی بازنمایی نمی‌کند.
   */
  const shareBannerDismiss = useAlertDismissed(data ? `admin-share-${data.shareDeadline.ym}` : null);
  const loanOverdueDismiss = useAlertSetVisible(
    "admin-loanoverdue",
    data && data.loanOverdue.count > 0
      ? data.loanOverdue.details.map((d) => `${d.loanId}-${d.number}`)
      : null,
  );

  const load = useCallback(async () => {
    try {
      const [d, s, dep, lo] = await Promise.all([
        fetch("/api/admin/dashboard").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/storage-status").then((r) =>
          r.ok ? r.json() : { mode: "unknown" },
        ),
        // جلسه ۶۰ — واریزی‌ها و وام‌ها برای دو کارت «کل واریزی‌ها / کل تسهیلات»
        fetch("/api/bank/deposits").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/bank/loans").then((r) => (r.ok ? r.json() : [])),
      ]);
      if (d) setData(d as DashboardData);
      const deposits: { amount: number }[] = Array.isArray(dep) ? dep : [];
      const loans: { disbursedAmount: number }[] = Array.isArray(lo) ? lo : [];
      setMoney({
        deposits: deposits.reduce((x, v) => x + (Number(v.amount) || 0), 0),
        loans: loans.reduce((x, v) => x + (Number(v.disbursedAmount) || 0), 0),
      });
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
        {/* جلسه ۶۰ — هیرو خوش‌آمدگویی با تصویر سه‌بعدی طبق طراحی PDF کاربر:
            «سلام مدیر عزیز / به سامانه صندوق خانوادگی خوش آمدید» + موجودی بانک */}
        <div className="relative overflow-hidden rounded-3xl shadow-lg shadow-primary-900/20">
          <img src="/hero-banner.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-primary-950/80 via-primary-900/35 to-transparent" />
          <div className="relative px-5 py-7 text-white">
            <p className="text-lg font-bold drop-shadow-sm">سلام مدیر عزیز</p>
            <p className="mt-1 text-xs text-white/85">به سامانه صندوق خانوادگی خوش آمدید</p>
            <p className="mt-4 text-[11px] text-white/80">موجودی کلی بانک</p>
            <p className="mt-1 text-2xl font-black leading-8 tracking-tight drop-shadow-sm">
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

        {/* جلسه ۶۰ — چهار کارت آماری خانهٔ مدیر طبق PDF (رنگ‌های بنفش/سبز/آبی/نارنجی):
            تعداد اعضا / موجودی کل صندوق / کل واریزی‌ها / کل تسهیلات پرداختی */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <ClayIcon name="users" size={34} />
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">تعداد اعضا</p>
            </div>
            <p className="mt-2.5 text-lg font-black text-zinc-800 dark:text-zinc-100">
              {loaded && fund ? faMoney(fund.members) : "…"}
              <span className="mr-1 text-[11px] font-normal text-zinc-400">نفر</span>
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <ClayIcon name="wallet" size={34} />
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">موجودی کل صندوق</p>
            </div>
            <p className="mt-2.5 text-lg font-black text-zinc-800 dark:text-zinc-100">
              {loaded && fund ? faMoney(fund.balance) : "…"}
              <span className="mr-1 text-[11px] font-normal text-zinc-400">تومان</span>
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <ClayIcon name="deposit" size={34} />
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">کل واریزی‌ها</p>
            </div>
            <p className="mt-2.5 text-lg font-black text-zinc-800 dark:text-zinc-100">
              {money ? faMoney(money.deposits) : "…"}
              <span className="mr-1 text-[11px] font-normal text-zinc-400">تومان</span>
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <ClayIcon name="banknote" size={34} />
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">کل تسهیلات پرداختی</p>
            </div>
            <p className="mt-2.5 text-lg font-black text-zinc-800 dark:text-zinc-100">
              {money ? faMoney(money.loans) : "…"}
              <span className="mr-1 text-[11px] font-normal text-zinc-400">تومان</span>
            </p>
          </div>
        </div>

        {/* اعلان‌های مهلت — جلسه ۳۸: سهام تا روز ۵ ماه؛ اقساط معوق همیشه قرمز؛
            جلسه ۴۰: هر دو قابل بسته شدن (تا دورهٔ بعد) */}
        {data && data.shareUnpaid.members > 0 && !shareBannerDismiss.dismissed && (
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
            onClose={shareBannerDismiss.close}
          />
        )}
        {data && loanOverdueDismiss.visible && (
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
            onClose={loanOverdueDismiss.close}
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
        {/* جلسه ۴۱: جعبه سبز «ذخیره‌سازی دائمی فعال است» حذف شد — توضیح
            ذخیره‌سازی داده به بخش «راهنمای سیستم» در تنظیمات منتقل شد
            (به درخواست کاربر: توضیح‌ها یک‌جا در راهنما باشند). هشدار قرمزِ
            فعال‌نبودن ذخیره‌سازی دائمی باقی می‌ماند چون هشدار است نه توضیح. */}

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

        {/* جلسه ۴۸: جعبه توضیح «برای اینکه عضو بتواند وارد شود» حذف شد — توضیح
            به بخش «راهنمای سیستم» در تنظیمات پنل مدیریت منتقل شد (به درخواست
            کاربر: همه توضیحات کارکرد سیستم یک‌جا در راهنما باشد). */}
      </div>
    </AdminShell>
  );
}
