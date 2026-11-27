"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { installmentStatuses, jalaliParts, memberShareDue, parseAmount, RECEIPT_COMPRESS_THRESHOLD_BYTES, RECEIPT_MAX_CHARS, RECEIPT_RAW_MAX_BYTES, shareDeadlineState } from "@/lib/bank";
import { isWithdrawType } from "@/lib/deposit-types";
import ClayIcon, { toneForIcon, type ClayIconName } from "@/app/components/mobile/ClayIcon";
import MemberBell from "@/app/components/mobile/MemberBell";
// جلسه ۵۴: گارد دکمهٔ برگشت گوشی — مودال‌ها/تب‌های این داشبورد هم لایه حساب می‌شوند
import { useBackGuardRoot, useBackHandler } from "@/app/components/mobile/backGuard";
// جلسه ۵۲: راهنما دیگر در خانه رندر نمی‌شود؛ مربع «راهنما» در خدمات است.
import { useSwipeNav } from "@/app/components/mobile/useSwipeNav";
import { jalaliMonthKey, useAlertDismissed } from "@/app/components/useAlertDismiss";
import type {
  BankDeposit,
  BankLoan,
  BankMember,
  BankSettings,
  LoanRequest,
  PaymentRequest,
  PublicUser,
} from "@/lib/db";

/** جلسه ۳۶: «اقساط» و «تسهیلات» دو بخش جدا نبودند — حالا فقط یک بخش «تسهیلات»
 *  با دو گزینهٔ داخلی (درخواست تسهیلات / اقساط) وجود دارد.
 *  جلسه ۵۲: تب «تنظیمات» از خانه حذف شد — همهٔ آیتم‌هایش مربع‌های گرید
 *  «خدمات» در نوار پایین پوسته موبایل هستند و «راهنما» هم آن‌جاست.
 *  جلسه ۵۳: «پروفایل» هم از خانه حذف شد (به درخواست کاربر — مربع «پروفایل من»
 *  در خدمات همان کار را می‌دهد) — خانه ۳ مربع است: سهام، تسهیلات، واریز.
 *  جلسه ۵۸ (به درخواست کاربر): مربع/تب جدید «متفرقه» اضافه شد — واریز و
 *  برداشت‌های جدا از سهام و اقساط؛ واریزی سبز، برداشت قرمز و در جزئیات هر
 *  مورد «وضعیت حساب» بدهکار/طلبکار نوشته می‌شود. خانه ۴ مربع است. */
export type TabKey = "shares" | "loans" | "deposit" | "misc";

/**
 * حالت خانه پوسته موبایل: "tiles" = شبکه مربع‌های سر فصل‌ها؛ بقیه = همان بخش؛
 * "loans-installments" = پرش مستقیم به گزینهٔ اقساط داخل تسهیلات (جلسه ۳۶).
 */
export type DashboardTab = TabKey | "tiles" | "loans-installments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "shares", label: "سهام" },
  { key: "loans", label: "تسهیلات" },
  { key: "deposit", label: "واریز" },
  { key: "misc", label: "متفرقه" },
];

/** جلسه ۳۹ — ترتیب بخش‌ها برای ناوبری کشویی (swipe): حالت تعبیه‌شده از خانهٔ
 *  مربع‌ها شروع می‌شود و بخش‌ها بعد از آن؛ حالت مستقل ۴ تب دارد (جلسه ۵۸:
 *  متفرقه اضافه شد). RTL: کشیدن انگشت به راست = بخش بعدی، به چپ = قبلی. */
const SWIPE_ORDER_EMBEDDED: DashboardTab[] = ["tiles", "shares", "loans", "deposit", "misc"];
const SWIPE_ORDER_STANDALONE: DashboardTab[] = ["shares", "loans", "deposit", "misc"];

/** کلید یکسان‌شدهٔ بخش برای ناوبری کشویی (پرش عمیق loans-installments = loans) */
function swipeKey(tab: DashboardTab): Exclude<DashboardTab, "loans-installments"> {
  return tab === "loans-installments" ? "loans" : tab;
}

/**
 * مربع‌های خانه پوسته موبایل — هر سر فصل «یک تیکه»: لمس هر مربع مستقیم همان
 * بخش را باز می‌کند (بدون واسط داشبورد کلی). جلسه ۲۶ مرحله ۲.
 * جلسه ۵۳: مربع «پروفایل» حذف شد — اطلاعات حساب از مربع «پروفایل من» در خدمات.
 * جلسه ۵۸: مربع «متفرقه» اضافه شد (گرید ۲×۲).
 */
const HOME_TILES: { key: TabKey; label: string; icon: ClayIconName }[] = [
  { key: "shares", label: "سهام", icon: "coins" },
  { key: "loans", label: "تسهیلات", icon: "banknote" },
  { key: "deposit", label: "واریز", icon: "wallet" },
  { key: "misc", label: "متفرقه", icon: "swap" },
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

/** جلسه ۶۰ — برچسب فارسی انواع دفتری برای «آخرین فعالیت‌ها» خانهٔ یوزر
 *  (طبق طراحی PDF کاربر: فهرست آخرین فعالیت‌ها با فلش سبز/قرمز) */
const ACTIVITY_LABELS: Record<string, string> = {
  share: "پرداخت سهام",
  misc: "واریز متفرقه",
  profit: "تقسیم سود",
  loan_interest: "سود بانک",
  installment: "پرداخت قسط",
  withdraw_misc: "برداشت متفرقه",
  withdraw_share: "برداشت سهام",
  withdraw_installment: "برداشت قسط",
  withdraw_profit: "برداشت سود بانک",
};

/** فلش ↑ سبز برای واریز و ↓ قرمز برای برداشت — گلیف SVG کوچک (جلسه ۶۰) */
function ActivityArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      {up ? <path d="M12 19V5" /> : <path d="M12 5v14" />}
      {up ? <path d="M5 12l7-7 7 7" /> : <path d="M19 12l-7 7-7-7" />}
    </svg>
  );
}

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

/**
 * جلسه ۳۸ — وضعیت یادآوری هر قسط برای پنل عضو:
 * overdue = از سررسید گذشته و پرداخت نشده (قرمز)؛ awaiting = پرداخت ثبت شده
 * و در انتظار تأیید مدیر؛ soon = تا ۵ روز به سررسید مانده (کهربایی)؛
 * future = سررسید دورتر.
 */
type InstallmentAlertState = "overdue" | "awaiting" | "soon" | "future";

/** وضعیت محاسبه‌شدهٔ هر قسط برای نشان دادن رنگ و برچسب درست (جلسه ۳۸) */
type InstallmentRowMeta = {
  state: InstallmentAlertState;
  days: number | null;
};

/**
 * جلسه ۳۸ — وضعیت یادآوری سهام عضو:
 * ok = تعهد این ماه پرداخت شده؛ grace = تا روز ۵ ماه فرصت هست (کهربایی)؛
 * late = از روز ۵ گذشته و پرداخت نشده (قرمز)؛ pending = پرداخت ثبت شده و
 * منتظر تأیید مدیر است (کهربایی).
 */
type ShareAlertLevel = "ok" | "grace" | "late" | "pending";

type DashboardViewProps = {
  /** حالت تعبیه‌شده داخل پوسته موبایل (/mobile): بدون هدر و نوار پایین داخلی */
  embedded?: boolean;
  /** نمای اولیه — "tiles" فقط در حالت تعبیه‌شده معنا دارد (خانه مربع‌ها) */
  initialTab?: DashboardTab;
  /** جلسه ۵۳ — پرش مستقیم از اکشن‌های سریع تراکنش‌ها: بعد از لود داده، فرم
   *  پرداخت همان نوع برای اولین پرداخت در دسترس خودکار باز می‌شود */
  initialOpenPayment?: "share" | "installment";
  /** بازگشت به خانه مربع‌ها — اگر داده شود، بالای هر بخشِ باز دکمه بازگشت می‌آید */
  onBack?: () => void;
  /** گزارش هر تغییر بخش به والد تا state والد همیشه همگام بماند */
  onTabChange?: (tab: DashboardTab) => void;
};

/**
 * نمای داشبورد عضو — هم مستقل (/dashboard با نوار پایین تب‌ها) و هم تعبیه‌شده
 * به‌عنوان تب «خانه» پوسته موبایل (/mobile): آنجا خانه یعنی شبکه مربع‌های
 * سر فصل‌ها و هر بخش با دکمه بازگشت به‌صورت مستقل باز می‌شود (جلسه ۲۶).
 */
export default function DashboardView({
  embedded = false,
  initialTab = "shares",
  initialOpenPayment,
  onBack,
  onTabChange,
}: DashboardViewProps) {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);
  const [tab, setTab] = useState<DashboardTab>(initialTab === "loans-installments" ? "loans" : initialTab);
  /** جهت آخرین جابه‌جایی بخش برای انیمیشن ورود کشویی (جلسه ۳۹) */
  const [navDir, setNavDir] = useState<"next" | "prev">("next");
  /** گزینهٔ فعال داخل بخش «تسهیلات»: فرم درخواست یا جدول اقساط (جلسه ۳۶) */
  const [loansSub, setLoansSub] = useState<"request" | "installments">(
    initialTab === "loans-installments" ? "installments" : "request",
  );
  /** جلسه ۵۴ — حالت مستقل: پشتهٔ تب‌های قبلی برای دکمهٔ برگشت گوشی */
  const [tabSnapshots, setTabSnapshots] = useState<{ tab: DashboardTab }[]>([]);
  /** جلسه ۵۴ — هشدار «برای خروج دوباره برگشت را بزنید» (فقط حالت مستقل) */
  const [exitHint, setExitHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** مودال جزئیات تسهیلات تأییدشده — اقساط + مبلغ واریز شده + ارسال شبا (جلسه ۳۶) */
  const [loanDetail, setLoanDetail] = useState<LoanRequest | null>(null);
  const [payoutEditing, setPayoutEditing] = useState(false);
  const [payoutHolder, setPayoutHolder] = useState("");
  const [payoutCard, setPayoutCard] = useState("");
  const [payoutSheba, setPayoutSheba] = useState("");
  /** همگام‌سازی tab با initialTab والد (بازگشت به مربع‌ها / پرش از خدمات) —
      الگوی رسمی React: تنظیم state هنگام رندر با مقایسه مقدار قبلی، بدون effect */
  const [seenInitial, setSeenInitial] = useState<DashboardTab>(initialTab);
  if (initialTab !== seenInitial) {
    setSeenInitial(initialTab);
    setTab(initialTab === "loans-installments" ? "loans" : initialTab);
    setLoansSub(initialTab === "loans-installments" ? "installments" : "request");
  }
  /** تغییر بخش داخل خود داشبورد (مربع‌ها / سوایپ / تب‌های مستقل) + گزارش به والد */
  function changeTab(next: DashboardTab) {
    const order = embedded ? SWIPE_ORDER_EMBEDDED : SWIPE_ORDER_STANDALONE;
    setNavDir(order.indexOf(swipeKey(next)) >= order.indexOf(swipeKey(tab)) ? "next" : "prev");
    // جلسه ۵۴ — حالت مستقل: هر جابه‌جایی بخش یک «مرحله» است؛ در حالت تعبیه‌شده
    // پوستهٔ /mobile از طریق onTabChange خودش پشته می‌سازد
    if (!embedded) {
      setTabSnapshots((s) => [...s.slice(-29), { tab }]);
    }
    setTab(next);
    onTabChange?.(next);
  }

  /** سوایپ افقی بین بخش‌های داشبورد — RTL: راست = بعدی (جلسه ۳۹).
   *  در حالت تعبیه‌شده stopPropagation لازم است تا یک سوایپ، هم بخشِ داشبورد
   *  را عوض کند و هم به هندلر پوسته موبایل نشت کند و تب پوسته را جلو نزند. */
  function stepDash(delta: 1 | -1) {
    const order = embedded ? SWIPE_ORDER_EMBEDDED : SWIPE_ORDER_STANDALONE;
    const next = order[order.indexOf(swipeKey(tab)) + delta];
    if (!next) return;
    changeTab(next);
  }

  const dashSwipe = useSwipeNav(
    {
      onSwipeNext: () => stepDash(1),
      onSwipePrev: () => stepDash(-1),
    },
    { stopPropagation: true },
  );
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
  /**
   * جلسه ۳۸: ساعت مرجع برای محاسبهٔ یادآوری‌ها — بعد از mount تنظیم می‌شود تا
   * prerender سرور به `new Date()` نیفتد (خطای build Next.js 16) و HTML اولیه
   * با کلاینت اختلاف hydration نداشته باشد؛ هر ۶۰ ثانیه هم به‌روز می‌شود تا
   * اگر صفحه باز مانده، گذشتن مهلت/سررسید همان‌جا دیده شود.
   */
  const [nowTick, setNowTick] = useState<number | null>(null);
  useEffect(() => {
    // setTimeout صفر برای رعایت قانون react-hooks/set-state-in-effect (مثل load)
    const t0 = setTimeout(() => setNowTick(Date.now()), 0);
    const timer = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(timer);
    };
  }, []);

  const [shareModal, setShareModal] = useState(false);
  const [shareAmount, setShareAmount] = useState("");
  const [shareReceipt, setShareReceipt] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [payModal, setPayModal] = useState<{ loan: BankLoan; row: { number: number; amount: number } } | null>(null);
  const [payReceipt, setPayReceipt] = useState("");
  const [payNote, setPayNote] = useState("");
  /** مودال جزئیات تراکنش متفرقه لمس‌شده (جلسه ۵۸) */
  const [miscDetail, setMiscDetail] = useState<BankDeposit | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanMonths, setLoanMonths] = useState("");
  const [loanReason, setLoanReason] = useState("");
  const [busy, setBusy] = useState(false);

  /** جلسه ۵۴ — گارد دکمهٔ برگشت گوشی/مرورگر:
   *  ۱) اول مودال‌های باز این داشبورد بسته می‌شوند (هر دو حالت)؛
   *  ۲) در حالت مستقل بعد از آن تب قبلی بازگردانده می‌شود؛
   *  ۳) در ریشه، هشدار خروج از پوسته/گارد ریشه می‌آید. */
  useBackHandler(() => {
    if (loanDetail) {
      setLoanDetail(null);
      return true;
    }
    if (shareModal) {
      setShareModal(false);
      return true;
    }
    if (payModal) {
      setPayModal(null);
      return true;
    }
    // جلسه ۵۸ — مودال جزئیات متفرقه هم لایهٔ برگشت است
    if (miscDetail) {
      setMiscDetail(null);
      return true;
    }
    return false;
  }, 2);

  useBackHandler(
    () => {
      if (embedded) return false;
      if (tabSnapshots.length === 0) return false;
      const prev = tabSnapshots[tabSnapshots.length - 1];
      setTabSnapshots((all) => all.slice(0, -1));
      setNavDir("prev");
      setTab(prev.tab);
      return true;
    },
    0,
  );

  /** جلسه ۵۴ — حالت مستقل ریشهٔ گارد است (تعبیه‌شده: پوستهٔ /mobile ریشه است) */
  useBackGuardRoot(
    (show) => {
      setExitHint(show);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (show) hintTimer.current = setTimeout(() => setExitHint(false), 2200);
    },
    !embedded,
  );

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

  // در حالت تعبیه‌شده، گارد ریدایرکت با پوسته موبایل است — اینجا فقط رندر
  useEffect(() => {
    if (embedded) return;
    if (me === null) router.replace("/login");
    else if (me && me.role === "admin") router.replace("/admin");
  }, [me, router, embedded]);

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

  /** جلسه ۵۸ — تراکنش‌های «جدا از سهام و اقساط رسمی» بخش متفرقه؛ جلسه ۵۹: همهٔ
   *  انواع دفتری مدیر (پرداخت قسط و برداشت‌های withdraw_*) هم اضافه شدند —
   *  برای عضو deposits از قبل مخصوص خودش است (API عضو فیلتر می‌کند). */
  const MISC_TYPES = useMemo(
    () =>
      new Set([
        "misc",
        "profit",
        "loan_interest",
        "withdraw_misc",
        "installment",
        "withdraw_share",
        "withdraw_installment",
        "withdraw_profit",
      ]),
    [],
  );
  const miscRows = useMemo(
    () =>
      deposits
        .filter((d) => MISC_TYPES.has(d.type))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [deposits, MISC_TYPES],
  );
  const miscSummary = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    miscRows.forEach((d) => {
      if (isWithdrawType(d.type)) outSum += Number(d.amount) || 0;
      else inSum += Number(d.amount) || 0;
    });
    return { inSum, outSum };
  }, [miscRows]);

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

  /** جلسه ۶۰ (ظاهر جدید خانهٔ یوزر طبق طراحی PDF کاربر): موجودی سهام = جمع
   *  واریزی‌های نوع share خود عضو — همان تعریف «موجودی سهام» جلسه ۵۴ */
  const shareBalance = useMemo(
    () =>
      deposits
        .filter((d) => d.type === "share")
        .reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [deposits],
  );
  /** جمع اقساط پرداخت‌نشدهٔ وام‌های در جریان — «مانده اقساط» کارت آماری خانه */
  const installmentsRemaining = useMemo(
    () =>
      installmentRows
        .filter((r) => !r.paid && r.loanStatus === "active")
        .reduce((s, r) => s + r.amount, 0),
    [installmentRows],
  );
  /** خالص متفرقه برای کارت آماری خانه (واریز − برداشت) */
  const miscNet = miscSummary.inSum - miscSummary.outSum;
  /** آخرین فعالیت‌های عضو — ۴ تراکنش آخر با تاریخ شمسی و فلش سبز/قرمز */
  const recentActivity = useMemo(
    () =>
      [...deposits]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 4),
    [deposits],
  );
  /** نام کوچک برای هیرو خوش‌آمدگویی («سلام علی عزیز» طبق PDF) */
  const firstName =
    (member?.name || me?.fullName || me?.username || "").trim().split(/\s+/)[0] || "دوست عزیز";

  /**
   * جلسه ۳۸ — یادآوری سررسید اقساط: هر قسط پرداخت‌نشدهٔ وام‌های در جریان
   * بر اساس فاصلهٔ سررسیدش دسته‌بندی می‌شود. قسطی که پرداختش (رسیدش) ثبت
   * شده اما مدیر هنوز تأیید نکرده «awaiting» می‌شود و قرمز نشان داده نمی‌شود.
   * بعد از تأیید مدیر، قسط پرداخت‌شده حساب می‌شود و یادآوری خودبه‌خود پاک
   * می‌شود (چون همه‌چیز از دادهٔ واقعی بانک محاسبه می‌شود، نه انبار اعلان).
   */
  const installmentAlert = useMemo(() => {
    if (nowTick === null) {
      return { meta: new Map<string, InstallmentRowMeta>(), overdue: [], awaiting: [], soon: [] };
    }
    const today = new Date(nowTick);
    today.setHours(0, 0, 0, 0);
    const meta = new Map<string, InstallmentRowMeta>();
    type Row = (typeof installmentRows)[number] & { days: number | null };
    const overdue: Row[] = [];
    const awaiting: Row[] = [];
    const soon: Row[] = [];
    for (const r of installmentRows) {
      if (r.paid || r.loanStatus === "cancelled") continue;
      const key = `${r.loanId}-${r.number}`;
      const pending = paymentRequests.some(
        (p) =>
          p.kind === "installment" &&
          p.loanId === r.loanId &&
          p.installmentNumber === r.number &&
          p.status === "pending",
      );
      if (!r.dueAt) {
        meta.set(key, { state: pending ? "awaiting" : "future", days: null });
        if (pending) awaiting.push({ ...r, days: null });
        continue;
      }
      const diff = (new Date(r.dueAt).getTime() - today.getTime()) / 86400000;
      if (diff < 0) {
        const days = Math.ceil(-diff);
        meta.set(key, { state: pending ? "awaiting" : "overdue", days });
        if (pending) awaiting.push({ ...r, days });
        else overdue.push({ ...r, days });
      } else {
        const days = Math.floor(diff);
        if (days <= 5) {
          meta.set(key, { state: pending ? "awaiting" : "soon", days });
          if (pending) awaiting.push({ ...r, days });
          else soon.push({ ...r, days });
        } else {
          meta.set(key, { state: "future", days });
        }
      }
    }
    const byDue = (a: Row, b: Row) => (a.dueAt || "").localeCompare(b.dueAt || "");
    overdue.sort(byDue);
    soon.sort(byDue);
    return { meta, overdue, awaiting, soon };
  }, [installmentRows, paymentRequests, nowTick]);

  /**
   * جلسه ۳۸ — یادآوری مهلت سهام: مهلت تا روز ۵ هر ماه شمسی است؛ تا آن روز
   * کهربایی («X روز مانده»)، بعد از آن قرمز. اگر پرداخت ثبت شده و منتظر
   * تأیید مدیر است، به‌جای قرمز «در انتظار تأیید» کهربایی نشان داده می‌شود
   * و بعد از تأیید مدیر (ثبت واریزی در بانک) کل اعلان پاک می‌شود.
   */
  const shareAlert = useMemo(() => {
    if (!shareInfo || !member || nowTick === null) return null;
    const left = shareInfo.left;
    if (left <= 0) {
      return { level: "ok" as ShareAlertLevel, left: 0, daysLeft: 0, past: false, pendingShare: false };
    }
    const deadline = shareDeadlineState(new Date(nowTick));
    const pendingShare = paymentRequests.some((r) => r.kind === "share" && r.status === "pending");
    const level: ShareAlertLevel = pendingShare
      ? "pending"
      : deadline.past
        ? "late"
        : "grace";
    return { level, left, daysLeft: deadline.daysLeft, past: deadline.past, pendingShare };
  }, [shareInfo, member, paymentRequests, nowTick]);

  /** جلسه ۴۰ — ماه شمسیِ جاری برای شناسهٔ بستن اعلان‌ها؛ با عوض شدن ماه، اعلان‌ها دوباره باز می‌شوند */
  const alertMonth = nowTick === null ? null : jalaliMonthKey(new Date(nowTick));

  /**
   * جلسه ۴۰ — کارت یادآوری خانهٔ سهام: فقط در پنجرهٔ ۵ روز قبل از مهلت
   * (روزهای ۱ تا ۵ ماه شمسی با تعهد پرداخت‌نشده)؛ بعد از بستن، یادآوری فقط
   * داخل بخش سهام دیده می‌شود — دیگر هر روز در صفحهٔ اصلی نیست.
   */
  const homeShareReminder = shareAlert && shareAlert.level === "grace" ? shareAlert : null;

  /** جلسه ۴۰ — کارت یادآوری خانهٔ اقساط: فقط اقساطی که تا ۵ روز دیگر سررسید
   *  می‌شوند؛ معوق‌ها و «در انتظار تأیید» فقط داخل بخش تسهیلات نشان داده می‌شوند */
  const homeInstallmentReminder = installmentAlert.soon;

  /** نقطهٔ هشدار روی مربع‌های خانه — قرمز = معوق، کهربایی = یادآوری (جلسه ۳۸) */
  function tileDot(key: TabKey): "danger" | "warning" | null {
    if (key === "shares") {
      if (!shareAlert || shareAlert.level === "ok") return null;
      return shareAlert.level === "late" ? "danger" : "warning";
    }
    if (key === "loans") {
      if (installmentAlert.overdue.length > 0) return "danger";
      if (installmentAlert.awaiting.length > 0 || installmentAlert.soon.length > 0) return "warning";
      return null;
    }
    return null;
  }

  /**
   * جلسه ۵۳ — پرش مستقیم به اولین پرداخت در دسترس از اکشن‌های سریع صفحهٔ
   * تراکنش‌ها: «پرداخت سهام» فرم پرداخت سهام را با مبلغ پیش‌فرض (تعهد ماهانه)
   * باز می‌کند و «پرداخت قسط» مودال اولین قسطِ پرداخت‌نشده را — قسطی که درخواست
   * معلق دارد رد می‌شود (برای هر قسط فقط یک درخواست pending می‌شود) و اگر
   * هیچ قسط قابل پرداختی نبود، اعلان متنی همان‌جا نمایش داده می‌شود. فقط یک‌بار
   * در هر mount اجرا می‌شود؛ بعد از ثبت پرداخت و لود مجدد داده، مودال دوباره
   * خودکار باز نمی‌شود.
   */
  const autoOpenPaymentRef = useRef(false);
  useEffect(() => {
    if (loading || autoOpenPaymentRef.current) return;
    if (initialOpenPayment !== "share" && initialOpenPayment !== "installment") return;
    autoOpenPaymentRef.current = true;
    const timer = setTimeout(() => {
      if (initialOpenPayment === "share") {
        if (member && settings) {
          setShareAmount(String(settings.amountPerShare * Math.max(1, member.shares)));
          setShareReceipt("");
          setShareNote("");
          setShareModal(true);
        }
        return;
      }
      const first = installmentRows.find(
        (r) =>
          !r.paid &&
          r.loanStatus !== "cancelled" &&
          !paymentRequests.some(
            (p) =>
              p.kind === "installment" &&
              p.loanId === r.loanId &&
              p.installmentNumber === r.number &&
              p.status === "pending",
          ),
      );
      const loan = first ? loans.find((l) => l.id === first.loanId) : undefined;
      if (first && loan) {
        setPayModal({ loan, row: first });
        setPayReceipt("");
        setPayNote("");
        return;
      }
      const anyUnpaid = installmentRows.some((r) => !r.paid && r.loanStatus !== "cancelled");
      setNotice(
        anyUnpaid
          ? "پرداخت قسط شما ثبت شده و در انتظار تأیید مدیر است."
          : "قسطی برای پرداخت در دسترس نیست؛ همهٔ اقساط تسویه شده‌اند.",
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [loading, initialOpenPayment, member, settings, installmentRows, paymentRequests, loans]);

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

  /**
   * وام واقعی متصل به درخواست تأییدشده — تأیید نهایی وام را دقیقاً از مبلغ
   * همان درخواست می‌سازد؛ پس هم‌مبلغ‌ترین وامی که بعد از ثبت درخواست ساخته
   * شده انتخاب می‌شود (اگر فقط یک وام وجود داشته باشد همان برگرده می‌آید).
   */
  function loanForRequest(r: LoanRequest): BankLoan | null {
    const candidates = loans.filter((l) => l.principal === r.amount && l.createdAt >= r.createdAt);
    if (candidates.length > 0) return candidates[candidates.length - 1];
    return loans.length === 1 ? loans[0] : null;
  }

  /** باز کردن مودال جزئیات — فرم شبا هم از مقدار ذخیره‌شده پر می‌شود */
  function openLoanDetail(r: LoanRequest) {
    const saved = (settings?.loanPayoutAccounts ?? {})[r.id];
    setPayoutHolder(saved?.holder ?? "");
    setPayoutCard(saved?.cardNumber ?? "");
    setPayoutSheba(saved?.sheba ?? "");
    setPayoutEditing(!saved);
    setError("");
    setLoanDetail(r);
  }

  async function submitPayoutAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!loanDetail) return;
    if (!payoutCard.trim() && !payoutSheba.trim()) {
      setError("شماره کارت یا شماره شبا را وارد کنید.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/member/loan-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: loanDetail.id,
          holder: payoutHolder,
          cardNumber: payoutCard,
          sheba: payoutSheba,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ارسال شماره حساب ناموفق بود.");
        return;
      }
      setPayoutEditing(false);
      setNotice("شماره حساب برای مدیر ارسال شد؛ برای واریز تسهیلات استفاده می‌شود.");
      await load();
    } catch {
      setError("ارسال شماره حساب ناموفق بود.");
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
    <div
      className={
        embedded
          ? "flex flex-col"
          : "flex min-h-screen flex-col bg-zinc-50 pb-24 dark:bg-black dark:text-zinc-50"
      }
    >
      {!embedded && (
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* جلسه ۴۱: آواتار پروفایل دقیقاً هم‌رنگ زمینهٔ لوگو شد — همان
                  گرادیان سرمه‌ایِ پس‌زمینهٔ HouseLogo (#212F5A→#0F1B3D) */}
              <span
                className="clay grid size-9 shrink-0 place-items-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(140deg, #212F5A 0%, #0F1B3D 78%)" }}
              >
                م
              </span>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">پنل عضو</p>
                <h1 className="truncate text-base font-semibold">{me.fullName || me.username}</h1>
              </div>
              {/* جلسه ۳۷: زنگوله اعلان‌ها در هدر پنل عضو */}
              <span className="mr-1">
                <MemberBell />
              </span>
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
      )}

      {/* جلسه ۳۹ — سوایپ افقی بین بخش‌ها + انیمیشن ورود کشویی؛ هر بخش با کلید
          خودش remount می‌شود (مودال‌ها بیرون این main هستند و مختل نمی‌شوند) */}
      <main
        key={tab}
        {...dashSwipe}
        className={
          (embedded
            ? "w-full space-y-4 px-4 pb-6 pt-3"
            : "mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5") +
          (navDir === "prev" ? " page-in-prev" : " page-in-next")
        }
      >
        {/* دکمه بازگشت به خانه مربع‌ها — وقتی یک سر فصل به صورت مستقل باز شده
            (چه از مربع‌های خانه، چه از خدمات/اکشن‌های سریع) */}
        {embedded && tab !== "tiles" && onBack && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="بازگشت به خانه"
              className="clay-press grid size-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <ClayIcon name="chevron-right" size={24} ghost ghostColor="#334155" />
            </button>
            <h2 className="text-base font-bold">
              {TABS.find((t) => t.key === tab)?.label ?? "بخش"}
            </h2>
          </div>
        )}
        {tab === "tiles" && (
          <section className="space-y-4">
            {/* جلسه ۶۰ — بازطراحی خانهٔ یوزر طبق طراحی PDF کاربر:
                ۱) بنر خوش‌آمدگویی با تصویر سه‌بعدی (گوشی + سپر + برگ‌ها) */}
            <div className="relative overflow-hidden rounded-3xl shadow-md shadow-primary-900/20">
              <img src="/hero-banner.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-primary-950/80 via-primary-900/35 to-transparent" />
              <div className="relative px-4 py-6 text-white">
                <p className="text-base font-bold drop-shadow-sm">سلام {firstName} عزیز</p>
                <p className="mt-1 text-[11px] text-white/85">به فَم بانک خوش آمدید</p>
              </div>
            </div>

            {/* ۲) کارت موجودی با تصویر کیف پول سه‌بعدی — موجودی سهام (تعریف جلسه ۵۴) */}
            <div className="relative overflow-hidden rounded-3xl shadow-md shadow-primary-900/25">
              <img src="/wallet-card.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-primary-950/75 via-primary-900/30 to-transparent" />
              <div className="relative px-4 py-4 text-white">
                <p className="text-[11px] text-white/80">موجودی شما</p>
                <p className="mt-1 text-2xl font-black tracking-tight drop-shadow-sm">
                  {member ? `${faMoney(shareBalance)} تومان` : "…"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/70">جمع واریزی‌های سهام شما</p>
              </div>
            </div>

            {/* ۳) سه کارت آماری کوچک (سهام / مانده اقساط / متفرقه) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-2.5 text-center shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
                <ClayIcon name="coins" size={34} />
                <p className="mt-1.5 text-[9.5px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">سهام شما</p>
                <p className="mt-0.5 truncate text-[11px] font-black text-primary-700 dark:text-primary-300">
                  {member ? faMoney(shareBalance) : "…"}
                </p>
                <p className="text-[8.5px] leading-3 text-zinc-400">تومان</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-2.5 text-center shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
                <ClayIcon name="banknote" size={34} />
                <p className="mt-1.5 text-[9.5px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">مانده اقساط</p>
                <p className="mt-0.5 truncate text-[11px] font-black text-primary-700 dark:text-primary-300">
                  {member ? faMoney(installmentsRemaining) : "…"}
                </p>
                <p className="text-[8.5px] leading-3 text-zinc-400">تومان</p>
              </div>
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-2.5 text-center shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
                <ClayIcon name="wallet" size={34} />
                <p className="mt-1.5 text-[9.5px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">متفرقه</p>
                <p className="mt-0.5 truncate text-[11px] font-black text-primary-700 dark:text-primary-300">
                  {member ? faMoney(miscNet) : "…"}
                </p>
                <p className="text-[8.5px] leading-3 text-zinc-400">تومان (خالص)</p>
              </div>
            </div>

            {/* ۴) مربع‌های سر فصل‌ها — رفتار لمس مستقیم بدون تغییر (جلسه ۵۹:
                شبکه جمع‌وجور max-w و آیکون ۴۴ حفظ شد) */}
            <div className="mx-auto grid w-full max-w-[21rem] grid-cols-2 gap-3">
              {HOME_TILES.map((t) => {
                const [toneA, toneB] = toneForIcon(t.icon);
                // جلسه ۳۸: نقطهٔ هشدار روی مربع سهام/تسهیلات وقتی یادآوری فعال است
                const dot = tileDot(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => changeTab(t.key)}
                    style={{ backgroundImage: `linear-gradient(145deg, ${toneA}33 0%, ${toneB}1a 55%, transparent 100%)` }}
                    className="clay-press relative flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border border-zinc-200/70 bg-white shadow-md shadow-primary-900/5 transition hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-700"
                  >
                    {dot && (
                      <span
                        aria-label="یادآوری فعال"
                        className={`absolute left-3 top-3 size-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${
                          dot === "danger" ? "animate-pulse bg-red-500" : "bg-amber-400"
                        }`}
                      />
                    )}
                    <ClayIcon name={t.icon} size={44} />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* جلسه ۴۰ — کارت‌های یادآوری صفحهٔ اصلی: فقط ۵ روز قبل از سررسید؛
                با دکمهٔ بستن — بعد از بستن، یادآوری فقط در بخش مربوطه دیده می‌شود */}
            {homeShareReminder && (
              <HomeReminderCard
                icon="coins"
                title={
                  homeShareReminder.daysLeft === 0
                    ? "امروز روز ۵ ماه است — آخرین مهلت پرداخت سهام این ماه"
                    : `مهلت پرداخت سهام این ماه تا روز ۵ — ${faMoney(homeShareReminder.daysLeft)} روز مانده`
                }
                subtitle={`مانده تعهد سهام شما ${faMoney(homeShareReminder.left)} تومان است — برای پرداخت، بخش سهام را باز کنید.`}
                dismissKey={alertMonth ? `home-share-${alertMonth}` : null}
                onOpen={() => changeTab("shares")}
                openLabel="رفتن به بخش سهام"
              />
            )}
            {homeInstallmentReminder.length > 0 && (
              <HomeReminderCard
                icon="calendar"
                title={`یادآوری سررسید اقساط — ${faMoney(homeInstallmentReminder.length)} قسط تا ۵ روز دیگر سررسید می‌شود`}
                subtitle={homeInstallmentReminder
                  .slice(0, 2)
                  .map((r) => `${r.loanLabel} — قسط ${faMoney(r.number)} — سررسید ${faDate(r.dueAt)}`)
                  .join(" · ")}
                dismissKey={alertMonth ? `home-installments-${alertMonth}` : null}
                onOpen={() => changeTab("loans")}
                openLabel="رفتن به بخش تسهیلات"
              />
            )}

            {/* ۵) آخرین فعالیت‌ها — ۴ تراکنش آخر با فلش سبز/قرمز و تاریخ شمسی */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <ClayIcon name="clock" size={26} />
                <h3 className="text-sm font-bold">آخرین فعالیت‌ها</h3>
              </div>
              <div className="mt-3 space-y-2">
                {recentActivity.length === 0 && (
                  <p className="rounded-2xl border border-zinc-200 px-4 py-5 text-center text-xs leading-6 text-zinc-500 dark:border-zinc-800">
                    هنوز فعالیتی ثبت نشده است؛ پرداخت‌ها و واریزی‌های شما این‌جا دیده می‌شود.
                  </p>
                )}
                {recentActivity.map((d) => {
                  const isUp = !isWithdrawType(d.type);
                  return (
                    <div key={d.id} className="flex items-center gap-2.5">
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full ${
                          isUp
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                        }`}
                      >
                        <ActivityArrow up={isUp} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                          {ACTIVITY_LABELS[d.type] ?? "تراکنش"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{faDate(d.createdAt)}</p>
                      </div>
                      <p
                        className={`shrink-0 text-[12.5px] font-black ${
                          isUp ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {isUp ? "+" : "−"}
                        {faMoney(d.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-[11px] leading-6 text-zinc-400">
              برای هر بخش فقط مربع آن را لمس کنید تا مستقیم وارد همان بخش شوید.
            </p>
          </section>
        )}
        {tab !== "tiles" && notice && (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {tab !== "tiles" && error && !shareModal && !payModal && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {tab !== "tiles" && loading && <p className="text-sm text-zinc-500">در حال دریافت اطلاعات…</p>}
        {!loading && !member && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            حساب شما هنوز به عضوی از بانک متصل نشده است؛ با مدیر تماس بگیرید.
          </p>
        )}

        {tab === "shares" && (
          <section className="space-y-4">
            {/* جلسه ۳۸: یادآوری مهلت سهام — تا روز ۵ هر ماه کهربایی، بعد از آن قرمز؛
                با تأیید مدیر پرداخت، خودبه‌خود پاک می‌شود */}
            {shareAlert && shareAlert.level !== "ok" && (
              shareAlert.level === "late" ? (
                <ReminderBanner
                  tone="danger"
                  title="مهلت پرداخت سهام این ماه (روز ۵ ماه) گذشته است"
                  subtitle={`مانده تعهد سهام شما ${faMoney(shareAlert.left)} تومان است (تعهد ماهانه: ${shareInfo ? faMoney(shareInfo.monthlyDue) : "…"} تومان) — پرداخت را با دکمهٔ «پرداخت سهام» در همین بخش ثبت کنید.`}
                  rows={shareAlert.pendingShare ? ["پرداختی هم ثبت کرده‌اید که در انتظار تأیید مدیر است؛ پس از تأیید، مانده به‌روز می‌شود."] : undefined}
                  dismissKey={alertMonth ? `share-${alertMonth}-late` : null}
                />
              ) : shareAlert.level === "grace" ? (
                <ReminderBanner
                  tone="warning"
                  title={
                    shareAlert.daysLeft === 0
                      ? "امروز روز ۵ ماه است — آخرین مهلت پرداخت سهام این ماه"
                      : `مهلت پرداخت سهام این ماه تا روز ۵ است — ${faMoney(shareAlert.daysLeft)} روز مانده`
                  }
                  subtitle={`مانده تعهد سهام شما ${faMoney(shareAlert.left)} تومان است (تعهد ماهانه: ${shareInfo ? faMoney(shareInfo.monthlyDue) : "…"} تومان).`}
                  dismissKey={alertMonth ? `share-${alertMonth}-grace` : null}
                />
              ) : (
                <ReminderBanner
                  tone="warning"
                  title="پرداخت سهام شما ثبت شده و در انتظار تأیید مدیر است"
                  subtitle={`مانده تعهد فعلی ${faMoney(shareAlert.left)} تومان است و پس از تأیید مدیر به‌روز می‌شود.`}
                  dismissKey={alertMonth ? `share-${alertMonth}-pending` : null}
                />
              )
            )}
            {shareAlert?.level === "ok" && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                تعهد سهام این ماه شما کامل پرداخت شده است ✓
              </p>
            )}
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

        {tab === "loans" && (
          <section className="space-y-4">
            {/* جلسه ۳۸: یادآوری سررسید اقساط بالای بخش تسهیلات — اقساط معوق قرمز،
                ۵ روز قبل از سررسید کهربایی؛ با تأیید مدیر پاک می‌شود */}
            {installmentAlert.overdue.length > 0 && (
              <ReminderBanner
                tone="danger"
                title={`${faMoney(installmentAlert.overdue.length)} قسط از تاریخ سررسید گذشته و پرداخت نشده است`}
                subtitle={`جمع اقساط معوق: ${faMoney(installmentAlert.overdue.reduce((s, r) => s + r.amount, 0))} تومان — از دکمهٔ «پرداخت» همان قسط در گزینهٔ «اقساط» رسید را ثبت کنید یا با مدیر هماهنگ کنید.`}
                rows={installmentAlert.overdue.slice(0, 4).map(
                  (r) => `${r.loanLabel} — قسط ${faMoney(r.number)} — ${faMoney(r.amount)} تومان — سررسید ${faDate(r.dueAt)} (${faMoney(r.days ?? 0)} روز گذشته)`,
                )}
                more={Math.max(0, installmentAlert.overdue.length - 4)}
                dismissKey={alertMonth ? `installments-${alertMonth}-overdue` : null}
              />
            )}
            {installmentAlert.awaiting.length > 0 && (
              <ReminderBanner
                tone="warning"
                title={`${faMoney(installmentAlert.awaiting.length)} پرداخت قسط ثبت شده و در انتظار تأیید مدیر است`}
                subtitle="پس از تأیید مدیر، قسط «پرداخت‌شده» می‌شود و یادآوری‌اش پاک می‌گردد."
                rows={installmentAlert.awaiting.slice(0, 4).map(
                  (r) => `${r.loanLabel} — قسط ${faMoney(r.number)} — ${faMoney(r.amount)} تومان${r.days !== null && r.days > 0 ? ` — سررسید ${faDate(r.dueAt)}` : ""}`,
                )}
                dismissKey={alertMonth ? `installments-${alertMonth}-awaiting` : null}
              />
            )}
            {installmentAlert.soon.length > 0 && (
              <ReminderBanner
                tone="warning"
                title="یادآوری سررسید اقساط — ۵ روز قبل از سررسید"
                rows={installmentAlert.soon.slice(0, 4).map(
                  (r) => `${r.loanLabel} — قسط ${faMoney(r.number)} — ${faMoney(r.amount)} تومان — سررسید ${faDate(r.dueAt)}${r.days === 0 ? " (امروز)" : ` (${faMoney(r.days ?? 0)} روز دیگر)`}`,
                )}
                more={Math.max(0, installmentAlert.soon.length - 4)}
                dismissKey={alertMonth ? `installments-${alertMonth}-soon` : null}
              />
            )}

            {/* جلسه ۳۶: بخش «تسهیلات» دو گزینه دارد — درخواست تسهیلات و اقساط */}
            <div className="flex gap-2">
              <SubTab active={loansSub === "request"} onClick={() => setLoansSub("request")} label="درخواست تسهیلات" />
              <SubTab active={loansSub === "installments"} onClick={() => setLoansSub("installments")} label="اقساط" count={installmentRows.filter((r) => !r.paid && r.loanStatus !== "cancelled").length} />
            </div>

            {loansSub === "installments" && (
              <div className="space-y-4">
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
                    .map((row) => {
                      // جلسه ۳۸: وضعیت یادآوری هر قسط — قرمز برای معوق، کهربایی برای نزدیکِ سررسید
                      const meta = installmentAlert.meta.get(`${row.loanId}-${row.number}`);
                      return (
                      <div
                        key={`${row.loanId}-${row.number}`}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${
                          meta?.state === "overdue"
                            ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/40"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                        }`}
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
                          {row.paid ? (
                            <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS.approved}`}>
                              پرداخت‌شده
                            </span>
                          ) : meta?.state === "overdue" ? (
                            <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_CLASS.rejected}`}>
                              {faMoney(meta.days ?? 0)} روز از سررسید گذشته
                            </span>
                          ) : meta?.state === "awaiting" ? (
                            <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS.pending}`}>
                              در انتظار تأیید مدیر
                            </span>
                          ) : meta?.state === "soon" ? (
                            <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS.pending}`}>
                              {meta.days === 0 ? "سررسید امروز" : `${faMoney(meta.days ?? 0)} روز تا سررسید`}
                            </span>
                          ) : (
                            <span className={`rounded-lg px-2 py-1 text-xs ${STATUS_CLASS.pending}`}>
                              پرداخت‌نشده
                            </span>
                          )}
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
                      );
                    })}
                </div>
              </div>
            )}

            {loansSub === "request" && (
              <div className="space-y-4">
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
                            ? " — تأیید شد؛ لمس کنید: اقساط، مبلغ واریز شده و ارسال شماره حساب"
                            : ""
                        }`}
                        status={r.status}
                        onClick={r.status === "approved" ? () => openLoanDetail(r) : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
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
              const hasPrimary = Boolean(
                primary && (primary.bankName || primary.holder || primary.cardNumber || primary.sheba),
              );
              const hasAlternate = Boolean(
                alternate && (alternate.bankName || alternate.holder || alternate.cardNumber || alternate.sheba),
              );
              if (!hasPrimary && !hasAlternate) {
                return (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-6 text-center text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    هنوز اطلاعات حساب توسط مدیر ثبت نشده است؛ با مدیر بانک تماس بگیرید.
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

        {tab === "misc" && (
          <section className="space-y-4">
            {/* جلسه ۵۸ — بخش متفرقه: واریز و برداشت‌های جدا از سهام و اقساط */}
            <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs leading-6 text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              واریز و برداشت‌هایی جدا از سهام و اقساط این‌جا می‌آید — واریزی‌های
              مدیر (متفرقه یا تقسیم سود) سبز و برداشت‌ها قرمز هستند. لمس هر مورد
              جزئیات کامل را باز می‌کند.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">جمع واریزی متفرقه</p>
                <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-400">
                  {faMoney(miscSummary.inSum)} تومان
                </p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-[11px] text-red-800 dark:text-red-300">جمع برداشت متفرقه</p>
                <p className="mt-1 text-sm font-black text-red-700 dark:text-red-400">
                  {faMoney(miscSummary.outSum)} تومان
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {miscRows.length === 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <ClayIcon name="swap" size={48} className="mx-auto opacity-90" />
                  <p className="mt-3 text-xs text-zinc-500">
                    هنوز تراکنش متفرقه‌ای ثبت نشده است؛ واریز یا برداشت متفرقه از
                    سمت مدیر این‌جا دیده می‌شود.
                  </p>
                </div>
              )}
              {miscRows.map((d) => {
                // جلسه ۵۹ — همهٔ انواع برداشت قرمز؛ برچسب هر نوع از نگاشت زیر
                const isWithdraw = isWithdrawType(d.type);
                const typeLabel =
                  d.type === "withdraw_misc"
                    ? "برداشت متفرقه"
                    : d.type === "withdraw_share"
                      ? "برداشت سهام"
                      : d.type === "withdraw_installment"
                        ? "برداشت قسط"
                        : d.type === "withdraw_profit"
                          ? "برداشت سود بانک"
                          : d.type === "installment"
                            ? "پرداخت قسط"
                            : d.type === "profit"
                              ? "تقسیم سود"
                              : d.type === "loan_interest"
                                ? "سود بانک"
                                : "واریز متفرقه";
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setMiscDetail(d)}
                    aria-label={`جزئیات ${typeLabel}`}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-right shadow-sm transition active:scale-[0.99] ${
                      isWithdraw
                        ? "border-red-200 bg-red-50/90 dark:border-red-900 dark:bg-red-950/30"
                        : "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/30"
                    }`}
                  >
                    <ClayIcon
                      name={isWithdraw ? "withdraw" : "deposit"}
                      size={40}
                      tone={isWithdraw ? ["#FFB8A8", "#E06848"] : ["#B5EBA5", "#54B854"]}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {isWithdraw ? "برداشت" : "واریز"}
                        <span
                          className={`mr-2 rounded-lg px-2 py-0.5 text-[10px] font-normal ${
                            isWithdraw
                              ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                        {faDate(d.createdAt)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-[13px] font-black ${
                        isWithdraw
                          ? "text-red-700 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {isWithdraw ? "−" : "+"}
                      {faMoney(d.amount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {!embedded && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" data-noprint>
          <div className="mx-auto flex max-w-2xl">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => changeTab(t.key)}
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
      )}

      {/* جلسه ۵۴ — هشدار خروج با دکمهٔ برگشت گوشی در ریشهٔ حالت مستقل */}
      {!embedded && exitHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] mx-auto flex max-w-2xl justify-center px-6" data-noprint>
          <p className="rounded-full bg-zinc-900/90 px-5 py-2.5 text-center text-[11px] font-medium text-white shadow-lg dark:bg-zinc-800/95">
            برای خروج از فَم بانک، دوباره دکمهٔ برگشت را بزنید
          </p>
        </div>
      )}

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

      {/* جلسه ۵۸ — مودال جزئیات تراکنش متفرقه: وضعیت حساب بدهکار (واریز) یا طلبکار (برداشت) */}
      {miscDetail &&
        (() => {
          // جلسه ۵۹ — همهٔ انواع برداشت: طلبکار قرمز؛ واریزها: بدهکار سبز
          const isWithdraw = isWithdrawType(miscDetail.type);
          const typeLabel =
            miscDetail.type === "withdraw_misc"
              ? "برداشت متفرقه"
              : miscDetail.type === "withdraw_share"
                ? "برداشت سهام"
                : miscDetail.type === "withdraw_installment"
                  ? "برداشت قسط"
                  : miscDetail.type === "withdraw_profit"
                    ? "برداشت سود بانک"
                    : miscDetail.type === "installment"
                      ? "پرداخت قسط"
                      : miscDetail.type === "profit"
                        ? "تقسیم سود"
                        : miscDetail.type === "loan_interest"
                          ? "سود بانک"
                          : "واریز متفرقه";
          return (
            <Modal
              title={isWithdraw ? "جزئیات برداشت" : "جزئیات واریز"}
              onClose={() => setMiscDetail(null)}
            >
              <div className="space-y-2">
                {[
                  { label: "نوع تراکنش", value: typeLabel },
                  {
                    label: "شرح",
                    value: isWithdraw
                      ? "برداشت متفرقه از حساب شما توسط مدیر ثبت شد."
                      : "واریزی جدا از سهام و اقساط به حساب شما توسط مدیر ثبت شد.",
                  },
                  {
                    label: "وضعیت حساب",
                    value: isWithdraw ? "طلبکار" : "بدهکار",
                    tone: isWithdraw ? ("red" as const) : ("green" as const),
                  },
                  {
                    label: "مبلغ",
                    value: `${faMoney(miscDetail.amount)} تومان`,
                    tone: isWithdraw ? ("red" as const) : ("green" as const),
                  },
                  ...(miscDetail.title
                    ? [{ label: "عنوان ثبت‌شده", value: miscDetail.title }]
                    : []),
                  {
                    label: "تاریخ",
                    value: faDate(miscDetail.createdAt),
                  },
                ].map((line, i) => (
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
                <button
                  type="button"
                  onClick={() => setMiscDetail(null)}
                  className={`${btnPrimary} w-full`}
                >
                  بستن
                </button>
              </div>
            </Modal>
          );
        })()}

      {/* جلسه ۳۶: جزئیات تسهیلات تأییدشده — اقساط، مبلغ واریز شده و ارسال شبا */}
      {loanDetail &&
        (() => {
          const loan = loanForRequest(loanDetail);
          const saved = (settings?.loanPayoutAccounts ?? {})[loanDetail.id];
          const rows = loan ? installmentStatuses(loan) : [];
          const remaining = rows.filter((x) => !x.paid).reduce((s, x) => s + x.amount, 0);
          return (
            <Modal title={`جزئیات تسهیلات ${faMoney(loanDetail.amount)} تومانی`} onClose={() => setLoanDetail(null)}>
              <div className="space-y-4">
                <p className="text-xs leading-5 text-zinc-500">
                  تأیید شده{loanDetail.reviewedAt ? ` — ${faDate(loanDetail.reviewedAt)}` : ""}
                  {loanDetail.reviewNote ? ` — پیام مدیر: ${loanDetail.reviewNote}` : ""}
                </p>
                {loan ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="مبلغ واریز شده به شما" value={`${faMoney(loan.disbursedAmount)} تومان`} />
                      <StatCard label="کل بازپرداخت" value={`${faMoney(loan.totalAmount)} تومان`} />
                      <StatCard label="تعداد اقساط" value={loan.installmentCount.toLocaleString("fa-IR")} />
                      <StatCard label="مانده اقساط" value={`${faMoney(remaining)} تومان`} />
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <div className="max-h-56 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
                        {rows.map((x) => (
                          <div key={x.number} className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 text-xs">
                            <span className="font-medium">قسط {x.number.toLocaleString("fa-IR")}</span>
                            <span className="text-zinc-500">
                              {faMoney(x.amount)} تومان — سررسید {x.dueAt ? faDate(x.dueAt) : "—"}
                            </span>
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] ${x.paid ? STATUS_CLASS.approved : STATUS_CLASS.pending}`}>
                              {x.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] leading-5 text-zinc-500">
                      برای پرداخت هر قسط، به گزینهٔ «اقساط» در همین بخش تسهیلات بروید.
                    </p>
                  </>
                ) : (
                  <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    وام متصل به این درخواست در بانک پیدا نشد؛ برای بررسی با مدیر تماس بگیرید.
                  </p>
                )}

                <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/40">
                  {saved && !payoutEditing ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-primary-800 dark:text-primary-300">
                        شماره حساب ارسال‌شده برای واریز تسهیلات
                      </p>
                      {saved.holder && <p className="text-sm">به نام: {saved.holder}</p>}
                      {saved.cardNumber && (
                        <p dir="ltr" className="text-left font-mono text-xs tracking-wider">
                          {formatCard(saved.cardNumber)}
                        </p>
                      )}
                      {saved.sheba && (
                        <p dir="ltr" className="text-left font-mono text-xs tracking-wider">
                          {formatSheba(saved.sheba)}
                        </p>
                      )}
                      {saved.submittedAt && (
                        <p className="text-[11px] text-zinc-500">ارسال در {faDate(saved.submittedAt)}</p>
                      )}
                      <button type="button" onClick={() => setPayoutEditing(true)} className={btnGhost}>
                        ویرایش شماره حساب
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={submitPayoutAccount} className="space-y-3">
                      <p className="text-xs leading-5 text-primary-900 dark:text-primary-200">
                        اطلاعات بانکی خود را جهت واریز وام مربوطه به مدیر ارسال کنید.
                      </p>
                      <input
                        value={payoutHolder}
                        onChange={(e) => setPayoutHolder(e.target.value)}
                        placeholder="به نام (اختیاری)"
                        className={inputClass}
                      />
                      <input
                        value={payoutCard}
                        onChange={(e) => setPayoutCard(e.target.value)}
                        placeholder="شماره کارت (۱۶ رقم — اختیاری اگر شبا می‌دهید)"
                        dir="ltr"
                        inputMode="numeric"
                        className={`${inputClass} text-left`}
                      />
                      <input
                        value={payoutSheba}
                        onChange={(e) => setPayoutSheba(e.target.value)}
                        placeholder="شماره شبا (IR + ۲۴ رقم — اختیاری اگر کارت می‌دهید)"
                        dir="ltr"
                        className={`${inputClass} text-left`}
                      />
                      <ModalError error={error} />
                      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                        {busy ? "در حال ارسال…" : "ارسال برای مدیر"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </Modal>
          );
        })()}
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

/** کارت اطلاعات یک حساب واریز: نام بانک + بنام + شماره کارت + شبا با دکمه کپی */
function AccountBlock({
  title,
  account,
  accent = false,
  copiedKey,
  onCopy,
}: {
  title: string;
  account: { bankName?: string; holder: string; cardNumber: string; sheba: string };
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
      {account.bankName && (
        <p className="mt-2 text-sm font-semibold">نام بانک: {account.bankName}</p>
      )}
      {account.holder && (
        <p className="mt-1 text-sm">به نام: {account.holder}</p>
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

function SubTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
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
      {label}
      {count !== undefined && ` (${count.toLocaleString("fa-IR")})`}
    </button>
  );
}

/**
 * جلسه ۴۰ — کارت یادآوری صفحهٔ اصلی (نمای مربع‌های خانه): فقط در پنجرهٔ
 * ۵ روز قبل از سررسید نشان داده می‌شود و دکمهٔ بستن دارد. بعد از بستن، روی
 * همین دستگاه تا ماه شمسی بعد در خانه پنهان است و یادآوری فقط داخل بخش
 * مربوطه (سهام/تسهیلات) می‌ماند. دکمهٔ میانی مستقیم همان بخش را باز می‌کند.
 */
function HomeReminderCard({
  icon,
  title,
  subtitle,
  dismissKey,
  onOpen,
  openLabel,
}: {
  icon: "coins" | "calendar";
  title: string;
  subtitle: string;
  dismissKey: string | null;
  onOpen: () => void;
  openLabel: string;
}) {
  const { dismissed, close } = useAlertDismissed(dismissKey);
  if (dismissed || !dismissKey) return null;
  return (
    <div className="relative rounded-2xl border border-amber-300 bg-amber-50 p-3.5 shadow-sm dark:border-amber-900 dark:bg-amber-950/50">
      <button
        type="button"
        onClick={close}
        aria-label="بستن این یادآوری"
        title="بستن — تا دورهٔ بعد در خانه نشان داده نمی‌شود (یادآوری در بخش مربوطه می‌ماند)"
        className="absolute left-3 top-3 grid size-7 place-items-center rounded-full text-base leading-none text-amber-800 opacity-60 transition hover:bg-amber-500/15 hover:opacity-100 dark:text-amber-300"
      >
        ×
      </button>
      <div className="flex items-start gap-3">
        <ClayIcon name={icon} size={40} tone={["#FFE08E", "#E8A62B"]} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-6 text-amber-800 dark:text-amber-300">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-900/80 dark:text-amber-200/80">{subtitle}</p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 rounded-xl bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-500/25 dark:text-amber-300"
          >
            {openLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * جلسه ۳۸ — بنر یادآوری/اعلان پنل عضو:
 * danger (قرمز) = از مهلت/سررسید گذشته؛ warning (کهربایی) = یادآوری قبل از
 * مهلت یا وضعیت «در انتظار تأیید». مشخصات هر مورد در ردیف‌های داخل بنر است.
 * جلسه ۴۰ — قابلیت بسته شدن: اگر dismissKey داده شود دکمهٔ × دارد و بنرِ
 * بسته‌شده روی همین دستگاه تا دورهٔ بعد (ماه شمسی جدید) دیگر نشان داده نمی‌شود؛
 * اعلان همچنان از دادهٔ بانک محاسبه می‌شود و با تسویه خودبه‌خود پاک می‌شود.
 */
function ReminderBanner({
  tone,
  title,
  subtitle,
  rows,
  more,
  dismissKey,
}: {
  tone: "danger" | "warning";
  title: string;
  subtitle?: string;
  rows?: string[];
  more?: number;
  /** شناسهٔ بستن — اگر داده شود بنر دکمهٔ × می‌گیرد */
  dismissKey?: string | null;
}) {
  const { dismissed, close } = useAlertDismissed(dismissKey ?? null);
  if (dismissed) return null;
  const boxCls =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
      : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
  const rowCls =
    tone === "danger"
      ? "bg-red-100/80 text-red-900 dark:bg-red-950/70 dark:text-red-200"
      : "bg-amber-100/80 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200";
  return (
    <div className={`relative rounded-2xl border p-4 shadow-sm ${boxCls}`}>
      {dismissKey && (
        <button
          type="button"
          onClick={close}
          aria-label="بستن این اعلان"
          title="بستن — تا دورهٔ بعد نشان داده نمی‌شود"
          className="absolute left-3 top-3 grid size-7 place-items-center rounded-full text-base leading-none opacity-60 transition hover:bg-black/10 hover:opacity-100"
        >
          ×
        </button>
      )}
      <p className="text-sm font-bold leading-6">{title}</p>
      {subtitle && <p className="mt-1 text-xs leading-5 opacity-90">{subtitle}</p>}
      {rows && rows.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {rows.map((row, i) => (
            <p key={i} className={`rounded-xl px-3 py-1.5 text-[11px] leading-5 ${rowCls}`}>
              {row}
            </p>
          ))}
          {more !== undefined && more > 0 && (
            <p className="text-[11px] font-medium opacity-75">و {faMoney(more)} مورد دیگر…</p>
          )}
        </div>
      )}
    </div>
  );
}

/** ردیف درخواست/واریزی — با onClick به دکمه تبدیل می‌شود (جزئیات تسهیلات، جلسه ۳۶) */
function RequestRow({ title, subtitle, status, approved, onClick, hint }: { title: string; subtitle: string; status?: PaymentRequest["status"]; approved?: boolean; onClick?: () => void; hint?: string }) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm">{title}</p>
        <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] font-medium text-primary-600 dark:text-primary-300">{hint}</p>
        )}
      </div>
      {(status || approved) && (
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${approved ? STATUS_CLASS.approved : status ? STATUS_CLASS[status] : ""}`}>
          {approved ? "تأیید شده" : status ? STATUS_LABEL[status] : ""}
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-right transition-colors hover:border-primary-300 dark:border-zinc-900 dark:hover:border-primary-700"
      >
        {body}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-900">
      {body}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div data-swipe-ignore className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
