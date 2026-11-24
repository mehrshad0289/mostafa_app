"use client";

import { useMemo } from "react";
import { loanPaid, loanRemaining, memberShareDue } from "@/lib/bank";
import type { BankDeposit, BankLoan, BankMember } from "@/lib/db";
import { useHydrated } from "./useHydrated";

type MemberDetailProps = {
  member: BankMember;
  deposits: BankDeposit[];
  loans: BankLoan[];
  amountPerShare: number;
  onBack: () => void;
};

const TYPE_LABELS: Record<BankDeposit["type"], string> = {
  share: "سهم ماهانه",
  loan_interest: "سود وام",
  profit: "واریزی سود",
  misc: "متفرقه",
};

const LOAN_STATUS_LABELS: Record<BankLoan["status"], string> = {
  active: "جاری",
  paid: "تسویه‌شده",
  cancelled: "لغو‌شده",
};

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

function toMoney(value: number): string {
  return `${faNum(Math.round(value))} تومان`;
}

const jalaliDateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
});

function faDate(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return jalaliDateFmt.format(date);
}

export default function MemberDetail({
  member,
  deposits,
  loans,
  amountPerShare,
  onBack,
}: MemberDetailProps) {
  const hydrated = useHydrated();

  const detail = useMemo(() => {
    if (!hydrated) return null;
    const now = new Date();
    const due = memberShareDue(member, deposits, amountPerShare, now);
    const memberLoans = loans
      .filter((l) => l.memberId === member.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const memberDeposits = deposits
      .filter((d) => d.memberId === member.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const loansRemaining = memberLoans.reduce(
      (sum, l) => sum + loanRemaining(l),
      0,
    );
    const debt = loansRemaining + due.left;
    return {
      due,
      memberLoans,
      memberDeposits,
      loansRemaining,
      debt,
      net: due.credit - debt,
    };
  }, [hydrated, member, deposits, loans, amountPerShare]);

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">پرونده مالی — {member.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {member.phone ? <span dir="ltr">{member.phone}</span> : "بدون تلفن"}
            {" · "}
            {faNum(member.shares)} سهم
            {member.settled && " · تسویه‌شده"}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={`${inputClass} bg-white dark:bg-zinc-950`}
        >
          بازگشت به فهرست
        </button>
      </div>

      {!detail ? (
        <p className="text-sm text-zinc-500">در حال محاسبه…</p>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-medium">خلاصه مالی</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                {/* ردیف صریح اعتبار — فیچر اصلی نمونه */}
                <dt className="text-[11px] text-zinc-500">
                  اعتبار (جمع واریزی سهام)
                </dt>
                <dd className="font-semibold">{toMoney(detail.due.credit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">طلب عضو</dt>
                <dd>{toMoney(detail.due.credit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">
                  بدهی عضو (مانده وام‌ها + مانده تعهد)
                </dt>
                <dd>{toMoney(detail.debt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">مانده خالص</dt>
                <dd
                  className={
                    detail.net < 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {toMoney(detail.net)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">
                  مانده وام‌ها ({faNum(detail.memberLoans.length)} وام)
                </dt>
                <dd>{toMoney(detail.loansRemaining)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">مانده تعهد ماه جاری</dt>
                <dd
                  className={
                    detail.due.left > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {toMoney(detail.due.left)}
                  {detail.due.overdue && (
                    <span className="mr-1 text-red-600 dark:text-red-400">
                      · عقب‌افتاده
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">تعهد ماهانه</dt>
                <dd>{toMoney(detail.due.monthlyDue)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">
                  موجودی نهایی (کل واریزی − کل تعهد)
                </dt>
                <dd>{toMoney(detail.due.balance)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">وضعیت</dt>
                <dd>
                  {member.settled
                    ? `تسویه‌شده${member.settledAt ? ` در ${faDate(member.settledAt)}` : ""}`
                    : "در جریان"}
                </dd>
              </div>
            </dl>
            {member.settled &&
              member.settlementClaim != null &&
              member.settlementDebt != null &&
              member.settlementNet != null && (
                <p className="mt-3 text-xs text-zinc-500">
                  اعداد ثبت‌شده تسویه: طلب {toMoney(member.settlementClaim)} ·
                  بدهی {toMoney(member.settlementDebt)} · مانده خالص{" "}
                  {toMoney(member.settlementNet)}
                </p>
              )}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled
                title="در استپ ۱۴ فعال می‌شود"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white opacity-40"
              >
                تسویه نهایی عضو
              </button>
              {!member.settled && (
                <span className="text-xs text-zinc-400">
                  دکمه تسویه در استپ ۱۴ فعال می‌شود.
                </span>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">
              وام‌های عضو ({faNum(detail.memberLoans.length)})
            </h3>
            {detail.memberLoans.length === 0 ? (
              <p className="text-sm text-zinc-500">وامی برای این عضو ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {detail.memberLoans.map((loan) => (
                  <li
                    key={loan.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        وام {toMoney(loan.principal)}
                        <span className="mr-2 rounded-lg border border-zinc-200 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:border-zinc-800">
                          {LOAN_STATUS_LABELS[loan.status]}
                        </span>
                        <span className="mr-2 text-[11px] font-normal text-zinc-500">
                          {loan.interestMode === "beginning"
                            ? `سود کسر از ابتدا: ${toMoney(loan.interestAmount)}`
                            : `سود اضافه به انتها: ${toMoney(loan.interestAmount)}`}
                        </span>
                      </p>
                      <p className="text-sm font-semibold">
                        مانده {toMoney(loanRemaining(loan))}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      کل بدهی {toMoney(loan.totalAmount)} · پرداخت‌شده{" "}
                      {toMoney(loanPaid(loan))} · {faNum(loan.installmentCount)} قسط ·{" "}
                      {faDate(loan.createdAt)}
                      {loan.note ? ` · ${loan.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">
              واریزی‌های عضو ({faNum(detail.memberDeposits.length)})
            </h3>
            {detail.memberDeposits.length === 0 ? (
              <p className="text-sm text-zinc-500">
                واریزی‌ای برای این عضو ثبت نشده است.
              </p>
            ) : (
              <ul className="space-y-2">
                {detail.memberDeposits.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {d.title}
                        <span className="mr-2 rounded-lg border border-zinc-200 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:border-zinc-800">
                          {TYPE_LABELS[d.type || "share"]}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {d.type === "share" && d.periodKey
                          ? `دوره ${d.periodKey} · `
                          : ""}
                        {faDate(d.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{toMoney(Number(d.amount))}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
