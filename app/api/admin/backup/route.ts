import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getBank, listAllRequests } from "@/lib/db";
import { installmentStatuses } from "@/lib/bank";

/**
 * پشتیبان‌گیری انتخابی ادمین (جلسه ۴۹ به درخواست کاربر: «تو پنل ادمین هم امکان
 * پشتیبان‌گیری از داده‌ها وجود داشته باشد؛ امکان انتخاب داده پشتیبان‌گیری هم
 * وجود داشته باشد»). با پارامتر ?parts= بخش‌های انتخابی JSON می‌آید و سمت
 * کلاینت از همان داده فایل اکسل (.xls) و نسخه چاپ‌شدنی PDF ساخته می‌شود.
 * بخش‌ها: members اعضا، deposits واریزی‌ها، loans وام‌ها و اقساط،
 * requests درخواست‌ها و حساب‌های شبا، settings تنظیمات، audit سوابق.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const raw = url.searchParams.get("parts") ?? "";
  const parts = new Set(
    raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => ["members", "deposits", "loans", "requests", "settings", "audit"].includes(p)),
  );
  if (parts.size === 0) {
    return NextResponse.json(
      { error: "حداقل یک بخش را برای پشتیبان‌گیری انتخاب کنید." },
      { status: 400 },
    );
  }

  try {
    const bank = await getBank();
    const payload: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      parts: Array.from(parts),
    };

    if (parts.has("members")) {
      payload.members = bank.members.map((m) => ({
        name: m.name,
        shares: m.shares,
        phone: m.phone,
        gender: m.gender,
        totalDeposited: m.totalDeposited,
        settled: m.settled,
        settlementNet: m.settlementNet,
        note: m.note,
        createdAt: m.createdAt,
      }));
    }
    if (parts.has("deposits")) {
      payload.deposits = bank.deposits.map((d) => ({
        memberName: d.memberName,
        type: d.type,
        title: d.title,
        amount: d.amount,
        periodKey: d.periodKey,
        createdAt: d.createdAt,
      }));
    }
    if (parts.has("loans")) {
      payload.loans = bank.loans.map((l) => ({
        memberName: l.memberName,
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
      }));
    }
    if (parts.has("requests")) {
      const { paymentRequests, loanRequests } = await listAllRequests();
      payload.paymentRequests = paymentRequests.map((r) => ({
        username: r.username,
        kind: r.kind,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt ?? null,
        reviewNote: r.reviewNote ?? null,
        installmentNumber: r.installmentNumber ?? null,
      }));
      payload.loanRequests = loanRequests.map((q) => ({
        username: q.username,
        amount: q.amount,
        months: q.months,
        reason: q.reason,
        status: q.status,
        createdAt: q.createdAt,
        reviewedAt: q.reviewedAt ?? null,
        reviewNote: q.reviewNote ?? null,
      }));
      payload.loanPayoutAccounts = Object.values(bank.settings.loanPayoutAccounts ?? {});
    }
    if (parts.has("settings")) {
      payload.settings = {
        amountPerShare: bank.settings.amountPerShare,
        depositTitles: bank.settings.depositTitles,
        duplicateWarning: bank.settings.duplicateWarning,
        depositAccounts: bank.settings.depositAccounts,
      };
    }
    if (parts.has("audit")) {
      payload.audit = bank.auditLog.map((a) => ({
        at: a.at,
        action: a.action,
        kind: a.kind,
        detail: a.detail,
      }));
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "دریافت اطلاعات برای پشتیبان‌گیری ناموفق بود." },
      { status: 500 },
    );
  }
}
