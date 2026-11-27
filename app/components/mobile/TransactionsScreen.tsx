"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClayIcon, { type ClayIconName, type ClayTone } from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { NavTarget } from "./nav";
import { useBackHandler } from "./backGuard";
import type { BankDeposit, BankLoan, BankLoanPayment, PaymentRequest, PublicUser } from "@/lib/db";

/**
 * اسلاید تراکنش‌ها — هدر سرمه‌ای با موجودی، دکمه چشم و اکشن‌های سریع
 * + برگه سفید تراکنش‌های اخیر: واریزها با پس‌زمینه سبز روشن.
 * مبالغ دیتابیس تومان است؛ موجودی به درخواست کاربر به ریال نمایش داده می‌شود.
 * جلسه ۵۳: اکشن‌های سریع عضو فقط دو دکمهٔ «پرداخت سهام» و «پرداخت قسط»
 * است (تسهیلات حذف شد) — لمس هرکدام مستقیم اولین پرداخت در دسترس را باز می‌کند.
 * جلسه ۵۴: سر فصل موجودی برای عضو «موجودی سهام» است — جمع واریزی‌های سهام
 * همان عضو (همان «اعتبار» طبق BANK_SPEC؛ قبلاً جمع کل واریزی‌های هر نوع بود).
 * جلسه ۵۴: مودال جزئیات باز با دکمهٔ برگشت گوشی بسته می‌شود (backGuard).
 */

type TxDirection = "in" | "out" | "pending";

type TxRow = {
  id: string;
  kind:
    | "share"
    | "loan_interest"
    | "profit"
    | "misc"
    | "withdraw_misc"
    | "installment"
    | "loan"
    | "pending-share"
    | "pending-installment";
  direction: TxDirection;
  title: string;
  subtitleName?: string;
  amount: number; // تومان
  at: string;
  /** رکورد مبدأ برای مودال جزئیات لمس تراکنش */
  deposit?: BankDeposit;
  loan?: BankLoan;
  payment?: BankLoanPayment;
  paymentIndex?: number;
  memberName?: string;
};

const DEPOSIT_META: Record<BankDeposit["type"], { icon: ClayIconName; tone: ClayTone }> = {
  share: { icon: "coins", tone: ["#FFD98E", "#F0A32B"] },
  loan_interest: { icon: "banknote", tone: ["#FFB3C6", "#E85E8A"] },
  profit: { icon: "chart", tone: ["#8FE0DC", "#2FA8A2"] },
  misc: { icon: "wallet", tone: ["#B5EBA5", "#54B854"] },
  withdraw_misc: { icon: "withdraw", tone: ["#FFB8A8", "#E06848"] },
};

/** نام کانونی هر نوع واریز — جلسه ۲۶ + جلسه ۵۸ (برداشت متفرقه) */
const DEPOSIT_KIND_LABEL: Record<BankDeposit["type"], string> = {
  share: "واریز سهام بانک",
  loan_interest: "سود بانک",
  profit: "سود بانک",
  misc: "واریز متفرقه",
  withdraw_misc: "برداشت متفرقه",
};

/** جلسه ۵۸ — انواع «جدا از سهام و اقساط» برای بخش متفرقه و برچسب بدهکار/طلبکار */
const MISC_FAMILY_KINDS = new Set<TxRow["kind"]>(["misc", "profit", "loan_interest", "withdraw_misc"]);

function fa(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

function faDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const p = jalaliParts(d);
    const date = `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
    const time = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    return { date, time };
  } catch {
    return { date: "—", time: "" };
  }
}

/** جلسه ۵۱ — شرح ساده هر تراکنش برای مودال جزئیات (توضیحات بعد از لمس، به درخواست کاربر) */
function txDescription(row: TxRow, isAdmin: boolean): string {
  if (row.kind === "pending-share")
    return "درخواست واریز سهام هنوز بررسی نشده است؛ پس از تأیید مدیر به تراکنش تبدیل می‌شود.";
  if (row.kind === "pending-installment")
    return isAdmin
      ? "درخواست پرداخت قسط هنوز بررسی نشده است؛ پس از تأیید، واریز قسط در بانک ثبت می‌شود."
      : "درخواست پرداخت قسط هنوز بررسی نشده است؛ پس از تأیید مدیر از حساب شما برداشت می‌شود.";
  if (row.kind === "loan")
    return isAdmin
      ? "برداشت مبلغ تسهیلات پرداخت‌شده به عضو از موجودی بانک."
      : "واریز مبلغ تسهیلات به حساب شما.";
  if (row.kind === "installment")
    return isAdmin
      ? "واریز بابت پرداخت قسط تسهیلات توسط عضو."
      : "برداشت بابت پرداخت قسط تسهیلات از حساب شما.";
  if (row.kind === "withdraw_misc")
    return isAdmin
      ? "برداشت متفرقه توسط مدیر ثبت شد."
      : "برداشت متفرقه از حساب شما توسط مدیر ثبت شد.";
  return isAdmin ? "واریز عضو به حساب بانک." : "واریز به حساب شما.";
}

function rowVisual(row: TxRow): { icon: ClayIconName; tone: ClayTone } {
  switch (row.kind) {
    case "installment":
      // جلسه ۵۰ — پرداخت قسط از نگاه مدیر ورود پول به بانک است (واریز سبز)،
      // از نگاه عضو برداشت از حساب اوست (قرمز)
      return row.direction === "in"
        ? { icon: "deposit", tone: ["#B5EBA5", "#54B854"] }
        : { icon: "withdraw", tone: ["#FFB8A8", "#E06848"] };
    case "loan":
      return { icon: "banknote", tone: ["#9CC6FF", "#4C82E0"] };
    case "pending-share":
    case "pending-installment":
      return { icon: "clock", tone: ["#FFE08E", "#E8A62B"] };
    default:
      return DEPOSIT_META[row.kind];
  }
}

/** جلسه ۵۰ + ۵۱ — خط‌های مودال جزئیات کامل هر تراکنش */
function detailLines(row: TxRow, isAdmin: boolean): { label: string; value: string; tone?: "green" | "red" | "amber" }[] {
  const lines: { label: string; value: string; tone?: "green" | "red" | "amber" }[] = [];
  const dt = faDateTime(row.at);
  const typeLabel =
    row.kind === "loan"
      ? "تسهیلات"
      : row.kind === "installment"
        ? "قسط تسهیلات"
        : row.kind === "pending-share"
          ? "درخواست پرداخت سهام"
          : row.kind === "pending-installment"
            ? "درخواست پرداخت قسط"
            : DEPOSIT_KIND_LABEL[row.kind];
  lines.push({ label: "نوع تراکنش", value: typeLabel });
  lines.push({ label: "شرح", value: txDescription(row, isAdmin) });
  if (row.kind === "pending-share" || row.kind === "pending-installment") {
    if (row.subtitleName) lines.push({ label: "کاربر", value: row.subtitleName });
  } else if (isAdmin && row.memberName) {
    lines.push({ label: "عضو", value: row.memberName });
  }
  lines.push({
    label: "مبلغ",
    value: `${fa(row.amount)} تومان`,
    tone: row.direction === "in" ? "green" : row.direction === "out" ? "red" : "amber",
  });
  // جلسه ۵۱ — اثر روی موجودی، نسبت به حساب عضو (پنل یوزر) یا موجودی بانک (پنل ادمین)
  if (row.direction === "in") {
    lines.push({
      label: "اثر روی حساب",
      value: isAdmin ? "افزایش موجودی بانک" : "افزایش موجودی حساب شما",
      tone: "green",
    });
  } else if (row.direction === "out") {
    lines.push({
      label: "اثر روی حساب",
      value: isAdmin ? "کاهش موجودی بانک" : "کاهش موجودی حساب شما",
      tone: "red",
    });
  } else {
    lines.push({ label: "وضعیت", value: "در انتظار تأیید مدیر", tone: "amber" });
  }
  // جلسه ۵۸ — تراکنش‌های جدا از سهام و اقساط (متفرقه/سود) در پنل یوزر با
  // برچسب دفتری بدهکار (واریز) یا طلبکار (برداشت) مشخص می‌شوند (به درخواست کاربر)
  if (!isAdmin && MISC_FAMILY_KINDS.has(row.kind)) {
    lines.push({
      label: "وضعیت حساب",
      value: row.direction === "out" ? "طلبکار" : "بدهکار",
      tone: row.direction === "out" ? "red" : "green",
    });
  }
  if (row.deposit) {
    if (row.deposit.title && row.deposit.title !== typeLabel) {
      lines.push({ label: "عنوان ثبت‌شده", value: row.deposit.title });
    }
    if (row.deposit.type === "share" && row.deposit.periodKey) {
      lines.push({ label: "دوره", value: row.deposit.periodKey });
    }
    lines.push({ label: "وضعیت ثبت", value: "ثبت‌شده در بانک" });
  }
  if (row.loan && row.kind === "loan") {
    lines.push({ label: "اصل وام", value: `${fa(row.loan.principal)} تومان` });
    lines.push({
      label: "تعداد اقساط",
      value: `${row.loan.installmentCount.toLocaleString("fa-IR")} قسط`,
    });
    lines.push({
      label: "وضعیت وام",
      value: row.loan.status === "paid" ? "تسویه‌شده" : row.loan.status === "cancelled" ? "لغوشده" : "در جریان",
    });
  }
  if (row.payment && row.loan) {
    const total = (row.loan.payments || []).length;
    lines.push({
      label: "شماره پرداخت",
      value: `پرداخت ${(row.paymentIndex || 0).toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")}`,
    });
    if (row.payment.note) lines.push({ label: "توضیح پرداخت", value: row.payment.note });
  }
  lines.push({ label: "تاریخ", value: `${dt.date}${dt.time ? ` — ساعت ${dt.time}` : ""}` });
  return lines;
}

type TransactionsScreenProps = {
  me: PublicUser;
  onNavigate: (target: NavTarget) => void;
};

type FilterKey = "all" | "in" | "out" | "pending";

export default function TransactionsScreen({ me, onNavigate }: TransactionsScreenProps) {
  const router = useRouter();
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(12);
  /** جلسه ۵۰ — تراکنش لمس‌شده؛ جزئیات کامل آن در مودال نمایش داده می‌شود */
  const [detailRow, setDetailRow] = useState<TxRow | null>(null);

  const isAdmin = me.role === "admin";

  /** جلسه ۵۴ — برگشت گوشی مودال جزئیاتِ باز را می‌بندد */
  useBackHandler(() => {
    if (detailRow) {
      setDetailRow(null);
      return true;
    }
    return false;
  }, 2);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/bank/deposits").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/bank/loans").then((r) => (r.ok ? r.json() : [])),
      isAdmin
        ? fetch("/api/admin/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [] }))
        : fetch("/api/member/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [] })),
    ])
      .then(([d, l, req]) => {
        if (!alive) return;
        setDeposits(Array.isArray(d) ? d : []);
        setLoans(Array.isArray(l) ? l : []);
        const prs = req && Array.isArray(req.paymentRequests) ? req.paymentRequests : [];
        // فقط درخواست‌های در انتظار در جریان تراکنش می‌آیند؛ تأییدشده‌ها خودشان واریز شده‌اند
        setRequests(prs.filter((r: PaymentRequest) => r.status === "pending"));
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const rows = useMemo<TxRow[]>(() => {
    const out: TxRow[] = [];
    // جلسه ۵۱ — عنوان همهٔ ردیف‌ها فقط «واریز» و «برداشت» است (به درخواست کاربر)؛
    // نوع/عنوان/دوره و بقیهٔ توضیحات در مودال جزئیاتِ بعد از لمس دیده می‌شود
    deposits.forEach((d) => {
      const kindLabel = DEPOSIT_KIND_LABEL[d.type || "share"];
      const isWithdraw = d.type === "withdraw_misc";
      const extra = isAdmin
        ? d.memberName || undefined
        : d.title && d.title !== kindLabel
          ? d.title
          : undefined;
      out.push({
        id: `d-${d.id}`,
        kind: d.type,
        // جلسه ۵۸ — برداشت متفرقه برای هر دو نقش «برداشت» قرمز است؛
        // بقیهٔ واریزی‌ها «واریز» سبز
        direction: isWithdraw ? "out" : "in",
        title: isWithdraw ? "برداشت" : "واریز",
        subtitleName: extra,
        amount: d.amount,
        at: d.createdAt,
        deposit: d,
        memberName: isAdmin ? d.memberName || undefined : undefined,
      });
    });
    loans.forEach((loan) => {
      // جلسه ۵۱ — دریافت تسهیلات برای عضو «واریز» سبز است (پول به حساب او
      // می‌آید)، نه «برداشت از بانک»؛ برای مدیر همان «برداشت» قرمز
      if (isAdmin && loan.disbursedAmount > 0) {
        out.push({
          id: `w-${loan.id}`,
          kind: "loan",
          direction: "out",
          title: "برداشت",
          subtitleName: loan.memberName,
          amount: loan.disbursedAmount,
          at: loan.createdAt,
          loan,
          memberName: loan.memberName || undefined,
        });
      }
      if (!isAdmin && loan.disbursedAmount > 0) {
        out.push({
          id: `l-${loan.id}`,
          kind: "loan",
          direction: "in",
          title: "واریز",
          amount: loan.disbursedAmount,
          at: loan.createdAt,
          loan,
        });
      }
      loan.payments.forEach((p, i) => {
        out.push({
          id: `p-${p.id}-${i}`,
          kind: "installment",
          // پرداخت قسط برای عضو برداشت از حساب اوست (قرمز)،
          // اما برای مدیر ورود پول به بانک است (واریز سبز)
          direction: isAdmin ? "in" : "out",
          title: isAdmin ? "واریز" : "برداشت",
          subtitleName: isAdmin ? loan.memberName : undefined,
          amount: p.amount,
          at: p.paidAt,
          loan,
          payment: p,
          paymentIndex: i + 1,
          memberName: isAdmin ? loan.memberName || undefined : undefined,
        });
      });
    });
    // جلسه ۵۱ — درخواست‌های در انتظار هم با همان عنوان واریز/برداشت (کهربایی)؛
    // قسطِ در انتظار از نگاه عضو برداشت است و از نگاه مدیر واریزِ آیندهٔ بانک
    requests.forEach((r) => {
      out.push({
        id: `r-${r.id}`,
        kind: r.kind === "share" ? "pending-share" : "pending-installment",
        direction: "pending",
        title: r.kind === "share" || isAdmin ? "واریز" : "برداشت",
        subtitleName: isAdmin ? r.username : undefined,
        amount: r.amount,
        at: r.createdAt,
        memberName: r.username,
      });
    });
    out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return out;
  }, [deposits, loans, requests, isAdmin]);

  /**
   * موجودی سر فصل (تومان) — جلسه ۵۴:
   * ادمین: موجودی بانک (واریزی‌ها منهای تسهیلات پرداختی؛ جلسه ۵۸: منهای
   * برداشت‌های متفرقه)؛
   * عضو: موجودی سهام = جمع واریزی‌های «سهام» خودش (اعتبار طبق BANK_SPEC —
   * واریزی‌های متفرقه/سود دیگر داخلش نیست؛ برای عضو deposits فقط واریزی‌های خودش است). */
  const balanceToman = useMemo(() => {
    if (isAdmin) {
      const dep = deposits
        .filter((d) => d.type !== "withdraw_misc")
        .reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const withdrawals = deposits
        .filter((d) => d.type === "withdraw_misc")
        .reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const out = loans.reduce((s, l) => s + (Number(l.disbursedAmount) || 0), 0);
      return dep - withdrawals - out;
    }
    return deposits
      .filter((d) => (d.type || "share") === "share")
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
  }, [isAdmin, deposits, loans]);

  const filtered = rows.filter((r) => (filter === "all" ? true : r.direction === filter));
  const visible = filtered.slice(0, limit);

  const monthSummary = useMemo(() => {
    const now = jalaliParts(new Date());
    let monthIn = 0;
    let monthOut = 0;
    rows.forEach((r) => {
      const p = jalaliParts(new Date(r.at));
      if (p.year === now.year && p.month === now.month) {
        if (r.direction === "in") monthIn += r.amount;
        if (r.direction === "out") monthOut += r.amount;
      }
    });
    return { monthIn, monthOut };
  }, [rows]);

  const quickActions: { label: string; icon: ClayIconName; target: NavTarget | { href: string } }[] = isAdmin
    ? [
        // جلسه ۵۸ — «ثبت واریز» به «ثبت تراکنش» تغییر کرد و مستقیم به فرم ثبت
        // تراکنش (واریز/برداشت، یک عضو یا همه اعضا) در بخش تراکنش‌ها می‌رود
        { label: "ثبت تراکنش", icon: "plus", target: { href: "/bank/transactions" } },
        // از جلسه ۲۷: اعضا مستقیم به بخش اعضای پنل مدیریت می‌رود (مدیریت کاربران فقط در پنل ادمین)
        { label: "اعضا", icon: "users", target: { href: "/bank/members" } },
        { label: "گزارش کامل", icon: "chart", target: { href: "/admin" } },
      ]
    : [
        // جلسه ۵۳: فقط دو اکشن به درخواست کاربر — لمس مستقیم فرم پرداخت همان نوع
        // برای اولین پرداخت در دسترس را باز می‌کند (openPayment در DashboardView)
        { label: "پرداخت سهام", icon: "coins", target: { tab: "home", dashboardTab: "shares", openPayment: "share" } },
        { label: "پرداخت قسط", icon: "calendar", target: { tab: "home", dashboardTab: "loans-installments", openPayment: "installment" } },
      ];

  function openQuick(target: NavTarget | { href: string }) {
    if ("href" in target) router.push(target.href);
    else onNavigate(target);
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "همه" },
    { key: "in", label: "واریز" },
    { key: "out", label: "برداشت" },
    { key: "pending", label: "در انتظار" },
  ];

  return (
    <div className="pb-4">
      {/* هدر سرمه‌ای موجودی */}
      <div className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-bl from-primary-600 via-primary-800 to-primary-950 px-5 pb-16 pt-4 text-white">
        <div className="pointer-events-none absolute -left-10 -top-10 size-36 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 left-16 size-44 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs font-medium text-white/70">{isAdmin ? "موجودی بانک" : "موجودی سهام"}</p>
          <div className="mt-1 flex items-center gap-2.5">
            <p className="text-[27px] font-black leading-9 tracking-tight">
              {balanceVisible ? (
                <>
                  {fa(balanceToman * 10)} <span className="text-base font-bold text-white/80">ریال</span>
                </>
              ) : (
                "••••••••"
              )}
            </p>
            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              aria-label={balanceVisible ? "پنهان کردن موجودی" : "نمایش موجودی"}
              className="clay-press grid size-8 place-items-center rounded-full bg-white/15 ring-1 ring-white/25"
            >
              <ClayIcon name="eye" size={22} ghost ghostColor="#fff" />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-white/55">معادل {fa(balanceToman)} تومان</p>

          {/* جلسه ۵۳: ادمین ۳ اکشن؛ عضو فقط ۲ اکشن «پرداخت سهام» و «پرداخت قسط» — گرید دو ستونه */}
          <div className={`mt-6 grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            {quickActions.map((a) => (
              <button key={a.label} type="button" onClick={() => openQuick(a.target)} className="clay-press flex flex-col items-center gap-1.5">
                <span className="grid size-13 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <ClayIcon name={a.icon} size={40} />
                </span>
                <span className="text-[10.5px] font-medium text-white/85">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* برگه سفید تراکنش‌ها */}
      <div className="relative z-10 -mt-8 rounded-t-[2rem] bg-zinc-50 px-4 pt-4 dark:bg-black">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">تراکنش‌های اخیر</h2>
          <div className="flex gap-1.5 text-[10px]">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              واریز ماه: {fa(monthSummary.monthIn)}
            </span>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              برداشت ماه: {fa(monthSummary.monthOut)}
            </span>
          </div>
        </div>

        {/* فیلترها — نوار اسکرول افقی؛ سوایپ روی آن نباید تعویض صفحه شود (جلسه ۳۹) */}
        <div data-swipe-ignore className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setLimit(12);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                filter === f.key
                  ? "bg-gradient-to-l from-primary-700 to-primary-500 text-white shadow-md shadow-primary-600/25"
                  : "border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* لیست */}
        <p className="mb-2 text-[10.5px] leading-5 text-zinc-400">
          برای دیدن جزئیات کامل هر تراکنش، آن را لمس کنید.
        </p>
        <div className="space-y-2">
          {loading && <p className="py-6 text-center text-xs text-zinc-500">در حال دریافت تراکنش‌ها…</p>}
          {!loading && visible.length === 0 && (
            <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <ClayIcon name="receipt" size={52} className="mx-auto opacity-90" />
              <p className="mt-3 text-xs text-zinc-500">تراکنشی در این دسته پیدا نشد.</p>
            </div>
          )}
          {visible.map((row) => {
            const v = rowVisual(row);
            const dt = faDateTime(row.at);
            const isDeposit = row.direction === "in";
            return (
              // جلسه ۵۰ — با لمس هر تراکنش مودال جزئیات کامل آن باز می‌شود؛
              // واریز سبز، برداشت قرمز، در انتظار تأیید کهربایی
              <button
                type="button"
                key={row.id}
                onClick={() => setDetailRow(row)}
                aria-label={`جزئیات تراکنش ${row.title}`}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right shadow-sm transition active:scale-[0.99] ${
                  isDeposit
                    ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : row.direction === "pending"
                      ? "border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30"
                      : "border-red-200 bg-red-50/90 dark:border-red-900 dark:bg-red-950/30"
                }`}
              >
                <ClayIcon name={v.icon} tone={v.tone} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {row.title}
                    {row.subtitleName ? ` — ${row.subtitleName}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                    {dt.date} {dt.time ? `· ${dt.time}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  <p className={`text-[13px] font-black ${row.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : row.direction === "pending" ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>
                    {row.direction === "in" ? "+" : row.direction === "out" ? "−" : ""}
                    {fa(row.amount)}
                  </p>
                  <p className="text-[9.5px] text-zinc-400">
                    {row.direction === "pending" ? "در انتظار تأیید" : "تومان"}
                  </p>
                </div>
              </button>
            );
          })}
          {!loading && filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 12)}
              className="w-full rounded-2xl border border-zinc-200 bg-white py-3 text-xs font-semibold text-primary-700 shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950 dark:text-primary-300"
            >
              نمایش تراکنش‌های بیشتر ({fa(filtered.length - limit)} مورد)
            </button>
          )}
        </div>
      </div>

      {/* جلسه ۵۰ — مودال جزئیات کامل تراکنش لمس‌شده */}
      {detailRow && (
        <div data-swipe-ignore className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">جزئیات تراکنش</h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label="بستن جزئیات"
                className="grid size-8 place-items-center rounded-full text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900"
              >
                ×
              </button>
            </div>
            <div className="space-y-1.5">
              {detailLines(detailRow, isAdmin).map((line, i) => (
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
                          : line.tone === "amber"
                            ? "text-amber-700 dark:text-amber-400"
                            : ""
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDetailRow(null)}
              className="mt-4 w-full rounded-2xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-700 dark:bg-primary-500"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
