"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClayIcon, { type ClayIconName, type ClayTone } from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { NavTarget } from "./nav";
import type { BankDeposit, BankLoan, PaymentRequest, PublicUser } from "@/lib/db";

/**
 * اسلاید تراکنش‌ها — هدر سرمه‌ای با موجودی ریالی، دکمه چشم و سه اکشن سریع
 * + برگه سفید تراکنش‌های اخیر: واریزها با پس‌زمینه سبز روشن.
 * مبالغ دیتابیس تومان است؛ موجودی به درخواست کاربر به ریال نمایش داده می‌شود.
 */

type TxDirection = "in" | "out" | "pending";

type TxRow = {
  id: string;
  kind: "share" | "loan_interest" | "profit" | "misc" | "installment" | "loan" | "pending-share" | "pending-installment";
  direction: TxDirection;
  title: string;
  subtitleName?: string;
  amount: number; // تومان
  at: string;
};

const DEPOSIT_META: Record<BankDeposit["type"], { icon: ClayIconName; tone: ClayTone }> = {
  share: { icon: "coins", tone: ["#FFD98E", "#F0A32B"] },
  loan_interest: { icon: "banknote", tone: ["#FFB3C6", "#E85E8A"] },
  profit: { icon: "chart", tone: ["#8FE0DC", "#2FA8A2"] },
  misc: { icon: "wallet", tone: ["#B5EBA5", "#54B854"] },
};

/** نام کانونی هر نوع واریز — جلسه ۲۶ (واریز سهام بانک، سود بانک، واریز متفرقه) */
const DEPOSIT_KIND_LABEL: Record<BankDeposit["type"], string> = {
  share: "واریز سهام بانک",
  loan_interest: "سود بانک",
  profit: "سود بانک",
  misc: "واریز متفرقه",
};

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

function rowVisual(row: TxRow): { icon: ClayIconName; tone: ClayTone } {
  switch (row.kind) {
    case "installment":
      return { icon: "withdraw", tone: ["#FFB8A8", "#E06848"] };
    case "loan":
      return { icon: "banknote", tone: ["#9CC6FF", "#4C82E0"] };
    case "pending-share":
    case "pending-installment":
      return { icon: "clock", tone: ["#FFE08E", "#E8A62B"] };
    default:
      return DEPOSIT_META[row.kind];
  }
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
  const [myTotal, setMyTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(12);

  const isAdmin = me.role === "admin";

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/bank/deposits").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/bank/loans").then((r) => (r.ok ? r.json() : [])),
      isAdmin
        ? fetch("/api/admin/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [] }))
        : fetch("/api/member/requests").then((r) => (r.ok ? r.json() : { paymentRequests: [] })),
      isAdmin
        ? Promise.resolve([])
        : fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([d, l, req, m]) => {
        if (!alive) return;
        setDeposits(Array.isArray(d) ? d : []);
        setLoans(Array.isArray(l) ? l : []);
        const prs = req && Array.isArray(req.paymentRequests) ? req.paymentRequests : [];
        // فقط درخواست‌های در انتظار در جریان تراکنش می‌آیند؛ تأییدشده‌ها خودشان واریز شده‌اند
        setRequests(prs.filter((r: PaymentRequest) => r.status === "pending"));
        if (!isAdmin && Array.isArray(m) && m.length > 0) {
          setMyTotal(Number(m[0].totalDeposited) || 0);
        }
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
    deposits.forEach((d) => {
      const kindLabel = DEPOSIT_KIND_LABEL[d.type || "share"];
      const extra = [isAdmin ? d.memberName : undefined, d.title && d.title !== kindLabel ? d.title : undefined]
        .filter(Boolean)
        .join(" · ");
      out.push({
        id: `d-${d.id}`,
        kind: d.type,
        direction: "in",
        title: kindLabel,
        subtitleName: extra || undefined,
        amount: d.amount,
        at: d.createdAt,
      });
    });
    loans.forEach((loan) => {
      if (isAdmin && loan.disbursedAmount > 0) {
        out.push({
          id: `w-${loan.id}`,
          kind: "loan",
          direction: "out",
          title: "برداشت از بانک",
          subtitleName: loan.memberName,
          amount: loan.disbursedAmount,
          at: loan.createdAt,
        });
      }
      if (!isAdmin && loan.disbursedAmount > 0) {
        out.push({
          id: `l-${loan.id}`,
          kind: "loan",
          direction: "in",
          title: "برداشت از بانک",
          amount: loan.disbursedAmount,
          at: loan.createdAt,
        });
      }
      loan.payments.forEach((p, i) => {
        out.push({
          id: `p-${p.id}-${i}`,
          kind: "installment",
          direction: "out",
          title: "پرداخت اقساط تسهیلات",
          subtitleName: isAdmin ? loan.memberName : undefined,
          amount: p.amount,
          at: p.paidAt,
        });
      });
    });
    requests.forEach((r) => {
      out.push({
        id: `r-${r.id}`,
        kind: r.kind === "share" ? "pending-share" : "pending-installment",
        direction: "pending",
        title: r.kind === "share" ? "درخواست پرداخت سهام" : "درخواست پرداخت قسط",
        subtitleName: r.username,
        amount: r.amount,
        at: r.createdAt,
      });
    });
    out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return out;
  }, [deposits, loans, requests, isAdmin]);

  /** موجودی — عضو: مجموع واریزی‌هایش؛ ادمین: واریزی بانک منهای تسهیلات پرداختی (تومان) */
  const balanceToman = useMemo(() => {
    if (isAdmin) {
      const dep = deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const out = loans.reduce((s, l) => s + (Number(l.disbursedAmount) || 0), 0);
      return dep - out;
    }
    return myTotal ?? 0;
  }, [isAdmin, deposits, loans, myTotal]);

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
        { label: "ثبت واریز", icon: "plus", target: { href: "/admin" } },
        { label: "اعضا", icon: "users", target: { tab: "users" } },
        { label: "گزارش کامل", icon: "chart", target: { href: "/admin" } },
      ]
    : [
        { label: "واریز سهام", icon: "coins", target: { tab: "home", dashboardTab: "shares" } },
        { label: "پرداخت قسط", icon: "calendar", target: { tab: "home", dashboardTab: "installments" } },
        { label: "درخواست وام", icon: "banknote", target: { tab: "home", dashboardTab: "loans" } },
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
          <p className="text-xs font-medium text-white/70">{isAdmin ? "موجودی بانک" : "موجودی حساب"}</p>
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

          <div className="mt-6 grid grid-cols-3 gap-2">
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

        {/* فیلترها */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <div
                key={row.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm ${
                  isDeposit
                    ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : row.direction === "pending"
                      ? "border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
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
                  <p className={`text-[13px] font-black ${row.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : row.direction === "pending" ? "text-amber-700 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                    {row.direction === "in" ? "+" : row.direction === "out" ? "−" : ""}
                    {fa(row.amount)}
                  </p>
                  <p className="text-[9.5px] text-zinc-400">
                    {row.direction === "pending" ? "در انتظار تأیید" : "تومان"}
                  </p>
                </div>
              </div>
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
    </div>
  );
}
