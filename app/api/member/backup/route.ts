import { NextResponse } from "next/server";
import { requireUser, } from "@/lib/auth";
import { getBank, listUserRequests } from "@/lib/db";
import { installmentStatuses } from "@/lib/bank";

/**
 * جلسه ۴۸ — پشتیبان‌گیری شخصی عضو (به درخواست کاربر: «در تنظیمات یوزر گزینه
 * پشتیبان‌گیری بزار»). خلاصه اطلاعات خود کاربر (واریزی‌ها، وام‌ها، اقساط و
 * درخواست‌ها) را JSON می‌دهد؛ سمت کلاینت از همین داده فایل اکسل (.xls) و
 * نسخه چاپ‌شدنی PDF ساخته می‌شود. فقط داده خود عضو — نه اعضای دیگر.
 */
export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  try {
    const bank = await getBank();
    const memberId = guard.user.memberId ?? "";
    const member = memberId
      ? bank.members.find((m) => m.id === memberId) ?? null
      : null;
    const deposits = memberId
      ? bank.deposits.filter((d) => d.memberId === memberId)
      : [];
    const loans = memberId
      ? bank.loans.filter((l) => l.memberId === memberId)
      : [];
    const { paymentRequests, loanRequests } = await listUserRequests(guard.user.id);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      profile: {
        fullName: guard.user.fullName,
        username: guard.user.username,
        phone: guard.user.phone || null,
        role: guard.user.role,
      },
      member: member
        ? {
            name: member.name,
            shares: member.shares,
            phone: member.phone,
            totalDeposited: member.totalDeposited,
            settled: member.settled,
            settlementNet: member.settlementNet,
            createdAt: member.createdAt,
          }
        : null,
      deposits: deposits.map((d) => ({
        type: d.type,
        title: d.title,
        amount: d.amount,
        periodKey: d.periodKey,
        createdAt: d.createdAt,
      })),
      loans: loans.map((l) => ({
        principal: l.principal,
        interestMode: l.interestMode,
        interestAmount: l.interestAmount,
        totalAmount: l.totalAmount,
        disbursedAmount: l.disbursedAmount,
        installmentCount: l.installmentCount,
        status: l.status,
        note: l.note,
        createdAt: l.createdAt,
        installments: installmentStatuses(l).map((row) => ({
          number: row.number,
          amount: row.amount,
          dueAt: row.dueAt,
          paid: row.paid,
        })),
        payments: l.payments.map((p) => ({
          amount: p.amount,
          paidAt: p.paidAt,
          note: p.note,
        })),
      })),
      paymentRequests: paymentRequests.map((r) => ({
        kind: r.kind,
        amount: r.amount,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt ?? null,
        reviewNote: r.reviewNote ?? null,
        installmentNumber: r.installmentNumber ?? null,
      })),
      loanRequests: loanRequests.map((q) => ({
        amount: q.amount,
        months: q.months,
        reason: q.reason,
        status: q.status,
        createdAt: q.createdAt,
        reviewedAt: q.reviewedAt ?? null,
        reviewNote: q.reviewNote ?? null,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "دریافت اطلاعات برای پشتیبان‌گیری ناموفق بود." },
      { status: 500 },
    );
  }
}
