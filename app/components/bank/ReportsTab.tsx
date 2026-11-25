"use client";

import { useMemo, useState } from "react";
import { loanPaid, loanRemaining, memberShareDue, monthlyTotals } from "@/lib/bank";
import type { BankDeposit, BankDepositType, BankLoan, BankMember } from "@/lib/db";
import { useHydrated } from "./useHydrated";
import { downloadCsv } from "./csv";

type ReportsTabProps = {
  members: BankMember[];
  deposits: BankDeposit[];
  loans: BankLoan[];
  amountPerShare: number;
};

const TYPE_LABELS: Record<BankDepositType, string> = {
  share: "سهم ماهانه",
  loan_interest: "سود وام",
  profit: "واریزی سود",
  misc: "متفرقه",
};

const FA_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const jalaliDateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
});

function faDate(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return jalaliDateFmt.format(date);
}

function toMoney(value: number): string {
  return `${value.toLocaleString("fa-IR")} تومان`;
}

/** «1405/08» → «آبان ۱۴۰۵» */
function faMonthKey(key: string): string {
  const [year, month] = key.split("/").map(Number);
  const monthName = FA_MONTHS[(month || 1) - 1] ?? "—";
  return `${monthName} ${year.toLocaleString("fa-IR", { useGrouping: false })}`;
}

const cellClass = "whitespace-nowrap px-3 py-2 text-xs";

/** خلاصه کل: جمع وام پرداختی تا کنون، کل سهام پرداختی، سود وام و مانده وام‌ها */
type Overall = {
  loanPaidTotal: number;
  loanRemainingTotal: number;
  loanInterestTotal: number;
  loanCount: number;
  sharePaidTotal: number;
  shareCount: number;
} | null;

export default function ReportsTab({
  members,
  deposits,
  loans,
  amountPerShare,
}: ReportsTabProps) {
  const hydrated = useHydrated();
  const [memberId, setMemberId] = useState("");

  const member = members.find((m) => m.id === memberId) ?? null;

  /** خلاصه کل بانک: جمع وام پرداختی تا کنون، کل سهام پرداختی، سود وام، مانده وام‌ها */
  const overall: Overall = useMemo(() => {
    if (!hydrated) return null;
    let loanPaidTotal = 0;
    let loanRemainingTotal = 0;
    let loanInterestTotal = 0;
    let loanCount = 0;
    for (const loan of loans) {
      if (loan.status === "cancelled") continue;
      loanPaidTotal += loanPaid(loan);
      loanRemainingTotal += loanRemaining(loan);
      loanInterestTotal += Math.max(
        0,
        Number(loan.totalAmount || 0) - Number(loan.principal || 0),
      );
      loanCount += 1;
    }
    const shareDeposits = deposits.filter((d) => d.type === "share");
    const sharePaidTotal = shareDeposits.reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0,
    );
    return {
      loanPaidTotal,
      loanRemainingTotal,
      loanInterestTotal,
      loanCount,
      sharePaidTotal,
      shareCount: shareDeposits.length,
    };
  }, [hydrated, loans, deposits]);

  /** خلاصه مالی عضو — همان فرمول‌های MemberDetail */
  const memberDetail = useMemo(() => {
    if (!hydrated || !member) return null;
    const now = new Date();
    const due = memberShareDue(member, deposits, amountPerShare, now);
    const memberLoans = loans.filter((l) => l.memberId === member.id);
    const loansRemaining = memberLoans.reduce(
      (sum, l) => sum + loanRemaining(l),
      0,
    );
    const memberDeposits = deposits
      .filter((d) => d.memberId === member.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return {
      due,
      memberLoans,
      memberDeposits,
      loansRemaining,
      debt: loansRemaining + due.left,
      net: due.credit - (loansRemaining + due.left),
    };
  }, [hydrated, member, deposits, loans, amountPerShare]);

  /** گردش ماهانه — گروه‌بندی تراکنش‌ها بر کلید ماه شمسی، تازه به قدیم */
  const months = useMemo(
    () => monthlyTotals({ deposits, loans }),
    [deposits, loans],
  );

  /** خلاصه سالانه — تجمیع گردش ماهانه بر سال شمسی */
  const years = useMemo(() => {
    const map = new Map<
      string,
      { share: number; interest: number; profit: number; repayment: number; loanOut: number }
    >();
    months.forEach((row) => {
      const year = row.key.slice(0, 4);
      const acc =
        map.get(year) ??
        { share: 0, interest: 0, profit: 0, repayment: 0, loanOut: 0 };
      acc.share += row.share;
      acc.interest += row.interest;
      acc.profit += row.profit;
      acc.repayment += row.repayment;
      acc.loanOut += row.loanOut;
      map.set(year, acc);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, totals]) => ({ year, ...totals }));
  }, [months]);

  /** ردیف‌های CSV گزارش عضو: خلاصه مالی + واریزی‌ها + وام‌ها (مطابق گزارش چاپی) */
  const memberReportCsvRows = (): (string | number | null | undefined)[][] => {
    if (!memberDetail) return [];
    return [
      ["خلاصه مالی"],
      ["اعتبار (جمع واریزی سهام)", memberDetail.due.credit],
      ["تعهد پرداخت‌شده", memberDetail.due.totalSharePaid],
      ["تعهد مانده", memberDetail.due.left],
      ["مانده وام‌ها", memberDetail.loansRemaining],
      ["بدهی کل", memberDetail.debt],
      ["مانده خالص", memberDetail.net],
      [],
      ["واریزی‌ها"],
      ["تاریخ", "نوع", "عنوان", "مبلغ"],
      ...memberDetail.memberDeposits.map((d) => [
        faDate(d.createdAt),
        TYPE_LABELS[d.type],
        d.title || "—",
        d.amount,
      ]),
      [],
      ["وام‌ها و اقساط"],
      ["تاریخ", "جمع وام", "پرداخت‌شده", "مانده", "اقساط"],
      ...memberDetail.memberLoans.map((l) => [
        faDate(l.createdAt),
        l.totalAmount,
        loanPaid(l),
        loanRemaining(l),
        `${l.payments.length}/${l.installmentCount}`,
      ]),
    ];
  };

  /** چاپ گزارش از پنجره چاپ مرورگر (Save as PDF) — فقط بخش گزارش‌ها */
  function printReport() {
    document.body.classList.add("printing-report");
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("printing-report"),
      { once: true },
    );
    window.print();
    setTimeout(() => document.body.classList.remove("printing-report"), 1000);
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";
  const flowLabels = [
    "سهم",
    "سود وام",
    "سود واریزی",
    "بازپرداخت",
    "پرداخت وام",
  ];
  const flowTotal = (
    row: { share: number; interest: number; profit: number; repayment: number; loanOut: number },
  ) => [row.share, row.interest, row.profit, row.repayment, row.loanOut];

  return (
    <div className="space-y-4" data-print-area="reports">
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">خلاصه کل بانک</h3>
        {!overall ? (
          <p className="text-sm text-zinc-500">در حال محاسبه…</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] text-zinc-500">کل وام پرداختی تا کنون</dt>
              <dd className="font-bold text-primary-700 dark:text-primary-300">
                {toMoney(overall.loanPaidTotal)}
              </dd>
              <dd className="text-[11px] text-zinc-500">
                {overall.loanCount.toLocaleString("fa-IR")} وام فعال — مانده: {toMoney(overall.loanRemainingTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">کل مبالغ پرداختی جهت سهام</dt>
              <dd className="font-bold text-emerald-700 dark:text-emerald-300">
                {toMoney(overall.sharePaidTotal)}
              </dd>
              <dd className="text-[11px] text-zinc-500">
                {overall.shareCount.toLocaleString("fa-IR")} واریزی سهام
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">سود وام ثبت‌شده</dt>
              <dd className="font-bold">{toMoney(overall.loanInterestTotal)}</dd>
              <dd className="text-[11px] text-zinc-500">جمع سود همه وام‌ها</dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">مانده کل وام‌ها</dt>
              <dd className="font-bold">{toMoney(overall.loanRemainingTotal)}</dd>
              <dd className="text-[11px] text-zinc-500">بازپرداخت باقی‌مانده</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">گزارش عضو</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className={`${inputClass} min-w-56 bg-white dark:bg-zinc-950`}
          >
            <option value="">— انتخاب عضو —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => downloadCsv("گزارش-عضو", [], memberReportCsvRows())}
            disabled={!member}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
          >
            CSV گزارش عضو
          </button>
          <button
            type="button"
            onClick={printReport}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
          >
            چاپ گزارش
          </button>
        </div>

        {!member ? (
          <p className="text-sm text-zinc-500">
            {members.length === 0
              ? "هنوز عضوی ثبت نشده است."
              : "برای دیدن گزارش، یک عضو را انتخاب کنید."}
          </p>
        ) : !memberDetail ? (
          <p className="text-sm text-zinc-500">در حال محاسبه…</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[11px] text-zinc-500">
                  اعتبار (جمع واریزی سهام)
                </dt>
                <dd>{toMoney(memberDetail.due.credit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">تعهد پرداخت‌شده</dt>
                <dd>{toMoney(memberDetail.due.totalSharePaid)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">تعهد مانده</dt>
                <dd>{toMoney(memberDetail.due.left)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">مانده وام‌ها</dt>
                <dd>{toMoney(memberDetail.loansRemaining)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">بدهی کل</dt>
                <dd>{toMoney(memberDetail.debt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">مانده خالص</dt>
                <dd
                  className={
                    memberDetail.net < 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {toMoney(memberDetail.net)}
                </dd>
              </div>
            </dl>

            <h4 className="pt-1 text-xs font-medium text-zinc-500">
              واریزی‌های عضو ({memberDetail.memberDeposits.length.toLocaleString("fa-IR")})
            </h4>
            {memberDetail.memberDeposits.length === 0 ? (
              <p className="text-sm text-zinc-500">واریزی‌ای ثبت نشده است.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-125 text-right text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 font-medium">تاریخ</th>
                      <th className="px-3 py-2 font-medium">نوع</th>
                      <th className="px-3 py-2 font-medium">عنوان</th>
                      <th className="px-3 py-2 font-medium">مبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberDetail.memberDeposits.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className={`${cellClass} text-zinc-500`}>
                          {faDate(d.createdAt)}
                        </td>
                        <td className={cellClass}>{TYPE_LABELS[d.type]}</td>
                        <td className={cellClass}>{d.title || "—"}</td>
                        <td className={cellClass}>{toMoney(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 className="pt-1 text-xs font-medium text-zinc-500">
              وام‌ها و اقساط عضو ({memberDetail.memberLoans.length.toLocaleString("fa-IR")})
            </h4>
            {memberDetail.memberLoans.length === 0 ? (
              <p className="text-sm text-zinc-500">وامی ثبت نشده است.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-150 text-right text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 font-medium">تاریخ</th>
                      <th className="px-3 py-2 font-medium">جمع وام</th>
                      <th className="px-3 py-2 font-medium">پرداخت‌شده</th>
                      <th className="px-3 py-2 font-medium">مانده</th>
                      <th className="px-3 py-2 font-medium">اقساط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberDetail.memberLoans.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className={`${cellClass} text-zinc-500`}>
                          {faDate(l.createdAt)}
                        </td>
                        <td className={cellClass}>{toMoney(l.totalAmount)}</td>
                        <td className={cellClass}>{toMoney(loanPaid(l))}</td>
                        <td className={cellClass}>{toMoney(loanRemaining(l))}</td>
                        <td className={cellClass}>
                          {`${l.payments.length.toLocaleString("fa-IR")} از ${l.installmentCount.toLocaleString("fa-IR")}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">گردش ماهانه</h3>
        {months.length === 0 ? (
          <p className="text-sm text-zinc-500">تراکنشی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-150 text-right text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 font-medium">ماه</th>
                  {flowLabels.map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className={`${cellClass} text-zinc-500`}>
                      {faMonthKey(row.key)}
                    </td>
                    {flowTotal(row).map((value, i) => (
                      <td key={flowLabels[i]} className={cellClass}>
                        {toMoney(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300 font-medium dark:border-zinc-600">
                  <td className={cellClass}>جمع کل</td>
                  {flowLabels.map((_, i) => (
                    <td key={i} className={cellClass}>
                      {toMoney(
                        months.reduce(
                          (sum, row) => sum + flowTotal(row)[i],
                          0,
                        ),
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">خلاصه سالانه</h3>
        {years.length === 0 ? (
          <p className="text-sm text-zinc-500">تراکنشی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-150 text-right text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 font-medium">سال</th>
                  {flowLabels.map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((row) => (
                  <tr
                    key={row.year}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className={`${cellClass} text-zinc-500`}>
                      {Number(row.year).toLocaleString("fa-IR", { useGrouping: false })}
                    </td>
                    {flowTotal(row).map((value, i) => (
                      <td key={flowLabels[i]} className={cellClass}>
                        {toMoney(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
