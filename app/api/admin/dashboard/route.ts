import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  installmentStatuses,
  jalaliMonthSerial,
  jalaliParts,
  loanRemaining,
  memberShareDue,
  monthKey,
  recalcFund,
  shareDeadlineState,
} from "@/lib/bank";
import { getBank, getUnreadRequests } from "@/lib/db";

/**
 * آمار داشبورد ادمین:
 * - موجودی کلی بانک (واریزی‌ها + بازپرداخت‌ها − پرداختی وام)
 * - تعهد ماهانه سهام (جمع سهم اعضا × مبلغ هر سهم)
 * - تعهدات پرداخت‌نشده سهام (مانده تعهد ماه جاری اعضا با احتساب carry)
 *   + جزئیات هر عضو پرداخت‌نکرده (جلسه ۳۸) + وضعیت مهلت روز ۵ ماه
 * - تعهدات ماهانه وام (مبلغ کل اقساط با سررسید ماه شمسی جاری — پرداخت‌شده +
 *   پرداخت‌نشده؛ سهم هر کدام جداگانه هم برگردانده می‌شود)
 * - تعهدات باقی‌مانده وام (اقساط سررسیدشدهٔ ماه‌های قبل که پرداخت نشده‌اند)
 *   + جزئیات تک‌تک اقساط معوق (جلسه ۳۸)
 * - سود وام (جمع سود ثبت‌شدهٔ همه وام‌ها با تفکیک در جریان/تسویه‌شده)
 * - مانده کل اقساط همه وام‌ها (برای نمایش کمکی زیر کارت معوق)
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
  // جلسه ۳۸: مشخصات تک‌تک اعضایی که تعهد سهام این ماه را کامل نپرداخته‌اند
  const shareUnpaidDetails: {
    memberId: string;
    name: string;
    shares: number;
    monthlyDue: number;
    left: number;
  }[] = [];
  for (const m of bank.members) {
    const due = memberShareDue(m, bank.deposits, amountPerShare, now);
    if (due.left > 0) {
      shareUnpaid += due.left;
      membersWithShareDebt += 1;
      shareUnpaidDetails.push({
        memberId: m.id,
        name: m.name,
        shares: Math.max(0, Number(m.shares || 0)),
        monthlyDue: due.monthlyDue,
        left: due.left,
      });
    }
  }
  shareUnpaidDetails.sort((a, b) => b.left - a.left);

  // مهلت پرداخت سهام: تا روز ۵ هر ماه شمسی (جلسه ۳۸)
  const shareDeadline = shareDeadlineState(now);
  // جلسه ۴۰: ماه شمسی جاری برای شناسهٔ بستن اعلان‌ها (کلید ماهانه) —
  // سمت کلاینت new Date() در prerender خطا می‌دهد؛ اینجا سمت سرور حساب می‌شود
  const nowJalali = jalaliParts(now);
  const shareDeadlineYm = `${nowJalali.year}-${String(nowJalali.month).padStart(2, "0")}`;

  // اقساط وام: کل سررسید ماه جاری، معوق (سررسیدش روزش گذشته و پرداخت‌نشده) و مانده کل
  const currentKey = monthKey(now);
  const currentSerial = jalaliMonthSerial(currentKey);
  // جلسه ۳۸: معوق از نظر روز شمرده می‌شود، نه فقط ماه‌های قبل — قسطی که
  // سررسیدش (مثلاً دوم همین ماه) گذشته و پرداخت نشده هم معوق است.
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  let loanMonthlyDue = 0;
  let loanMonthlyCount = 0;
  let loanMonthlyPaid = 0;
  let loanOverdue = 0;
  let loanOverdueCount = 0;
  let loanOverdueLoans = 0;
  // جلسه ۳۸: مشخصات تک‌تک اقساط سررسیدشده و پرداخت‌نشده
  const loanOverdueDetails: {
    loanId: string;
    memberName: string;
    principal: number;
    number: number;
    amount: number;
    dueAt: string;
  }[] = [];
  let loanRemainingTotal = 0;
  let activeLoanCount = 0;
  for (const loan of bank.loans) {
    if (loan.status === "cancelled") continue;
    const remaining = loanRemaining(loan);
    if (remaining > 0) activeLoanCount += 1;
    loanRemainingTotal += remaining;
    let loanHasOverdue = false;
    for (const row of installmentStatuses(loan)) {
      const serial = jalaliMonthSerial(monthKey(row.dueAt));
      if (serial === currentSerial) {
        // کل سررسیدهای ماه جاری: پرداخت‌شده و پرداخت‌نشده با هم
        loanMonthlyDue += row.amount;
        loanMonthlyCount += 1;
        if (row.paid) loanMonthlyPaid += row.amount;
      }
      // معوق: سررسیدش گذشته و پرداخت‌نشده است (هر ماهی — جلسه ۳۸)
      if (!row.paid && new Date(row.dueAt).getTime() < todayStartMs) {
        loanOverdue += row.amount;
        loanOverdueCount += 1;
        loanHasOverdue = true;
        loanOverdueDetails.push({
          loanId: loan.id,
          memberName: loan.memberName,
          principal: loan.principal,
          number: row.number,
          amount: row.amount,
          dueAt: row.dueAt,
        });
      }
    }
    if (loanHasOverdue) loanOverdueLoans += 1;
  }
  loanOverdueDetails.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  // سود وام: جمع سود ثبت‌شدهٔ همه وام‌ها با تفکیک در جریان/تسویه‌شده
  let loanInterestTotal = 0;
  let loanInterestActive = 0;
  let loanInterestSettled = 0;
  for (const loan of bank.loans) {
    if (loan.status === "cancelled") continue;
    const interest = Math.max(
      0,
      Math.round(Number(loan.totalAmount || 0) - Number(loan.principal || 0)),
    );
    loanInterestTotal += interest;
    if (loan.status === "paid") loanInterestSettled += interest;
    else loanInterestActive += interest;
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
    shareUnpaid: {
      amount: shareUnpaid,
      members: membersWithShareDebt,
      details: shareUnpaidDetails,
    },
    shareDeadline: {
      day: shareDeadline.day,
      daysLeft: shareDeadline.daysLeft,
      past: shareDeadline.past,
      ym: shareDeadlineYm,
    },
    loanMonthlyDue: {
      amount: loanMonthlyDue,
      count: loanMonthlyCount,
      paid: loanMonthlyPaid,
      unpaid: loanMonthlyDue - loanMonthlyPaid,
    },
    loanOverdue: {
      amount: loanOverdue,
      count: loanOverdueCount,
      loans: loanOverdueLoans,
      details: loanOverdueDetails,
    },
    loanRemaining: { amount: loanRemainingTotal, loans: activeLoanCount },
    loanInterest: {
      total: loanInterestTotal,
      active: loanInterestActive,
      settled: loanInterestSettled,
    },
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
        // جلسه ۳۷: ارسال شبا/کارت برای واریز تسهیلات هم در لیست اعلان داشبورد
        ...unread.payouts.slice(0, 5).map((p) => ({
          id: p.requestId,
          kind: "payout" as const,
          username: p.username,
          amount: p.amount,
          installmentNumber: null,
          createdAt: p.submittedAt,
        })),
      ]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    },
  });
}
