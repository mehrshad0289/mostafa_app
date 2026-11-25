import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  installmentStatuses,
  jalaliMonthSerial,
  loanRemaining,
  memberShareDue,
  monthKey,
  recalcFund,
} from "@/lib/bank";
import { getBank, getUnreadRequests } from "@/lib/db";

/**
 * آمار داشبورد ادمین:
 * - موجودی کلی صندوق (واریزی‌ها + بازپرداخت‌ها − پرداختی وام)
 * - تعهد ماهانه سهام (جمع سهم اعضا × مبلغ هر سهم)
 * - تعهدات پرداخت‌نشده سهام (مانده تعهد ماه جاری اعضا با احتساب carry)
 * - تعهدات ماهانه وام (جمع اقساط پرداخت‌نشده با سررسید ماه شمسی جاری)
 * - تعهدات معوق وام (اقساط پرداخت‌نشده با سررسید ماه‌های قبل)
 * - تعهدات باقی‌مانده وام (مانده کل همه وام‌ها)
 * - درخواست‌های خوانده‌نشده اعضا
 */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const [bank, unread] = await Promise.all([getBank(), getUnreadRequests()]);
  const now = new Date();
  const amountPerShare = Math.max(0, Number(bank.settings.amountPerShare || 0));

  const fund = recalcFund(bank);

  // تعهد ماهانه سهام و تعهدات پرداخت‌نشده سهام
  const shareMonthlyDue = bank.members.reduce(
    (sum, m) => sum + Math.max(0, Number(m.shares || 0)) * amountPerShare,
    0,
  );
  let shareUnpaid = 0;
  let membersWithShareDebt = 0;
  for (const m of bank.members) {
    const due = memberShareDue(m, bank.deposits, amountPerShare, now);
    if (due.left > 0) {
      shareUnpaid += due.left;
      membersWithShareDebt += 1;
    }
  }

  // اقساط وام: سررسید ماه جاری، معوق و مانده کل
  const currentKey = monthKey(now);
  const currentSerial = jalaliMonthSerial(currentKey);
  let loanMonthlyDue = 0;
  let loanMonthlyCount = 0;
  let loanOverdue = 0;
  let loanOverdueCount = 0;
  let loanRemainingTotal = 0;
  let activeLoanCount = 0;
  for (const loan of bank.loans) {
    if (loan.status === "cancelled") continue;
    const remaining = loanRemaining(loan);
    if (remaining > 0) activeLoanCount += 1;
    loanRemainingTotal += remaining;
    for (const row of installmentStatuses(loan)) {
      if (row.paid) continue;
      const serial = jalaliMonthSerial(monthKey(row.dueAt));
      if (serial === currentSerial) {
        loanMonthlyDue += row.amount;
        loanMonthlyCount += 1;
      } else if (serial < currentSerial) {
        loanOverdue += row.amount;
        loanOverdueCount += 1;
      }
    }
  }

  return NextResponse.json({
    fund: {
      balance: fund.balance,
      totalInterest: fund.totalInterest,
      totalShares: fund.totalShares,
      members: bank.members.length,
      amountPerShare,
    },
    shareMonthlyDue,
    shareUnpaid: { amount: shareUnpaid, members: membersWithShareDebt },
    loanMonthlyDue: { amount: loanMonthlyDue, count: loanMonthlyCount },
    loanOverdue: { amount: loanOverdue, count: loanOverdueCount },
    loanRemaining: { amount: loanRemainingTotal, loans: activeLoanCount },
    unread: {
      count: unread.count,
      paymentCount: unread.paymentCount,
      loanCount: unread.loanCount,
      lastReadAt: unread.lastReadAt,
      latest: [
        ...unread.paymentRequests.slice(0, 5).map((r) => ({
          id: r.id,
          kind: r.kind as "share" | "installment",
          username: r.username,
          amount: r.amount,
          installmentNumber: r.installmentNumber ?? null,
          createdAt: r.createdAt,
        })),
        ...unread.loanRequests.slice(0, 5).map((r) => ({
          id: r.id,
          kind: "loan" as const,
          username: r.username,
          amount: r.amount,
          installmentNumber: null,
          createdAt: r.createdAt,
        })),
      ]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    },
  });
}
