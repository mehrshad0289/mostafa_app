import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { installmentStatuses } from "@/lib/bank";
import { createPaymentRequest, getBank } from "@/lib/db";

/** ثبت پرداخت قسط وام با عکس رسید — فقط قسط تسویه‌نشده وام خود کاربر */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json(
      { error: "این بخش فقط برای کاربران عضو است." },
      { status: 403 },
    );
  }
  let body: { loanId?: unknown; installmentNumber?: unknown; receipt?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const loanId = typeof body.loanId === "string" ? body.loanId : "";
  const installmentNumber = Math.floor(Number(body.installmentNumber));
  const receipt = typeof body.receipt === "string" ? body.receipt : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

  const bank = await getBank();
  const loan = bank.loans.find((l) => l.id === loanId);
  if (!loan || loan.memberId !== guard.user.memberId) {
    return NextResponse.json({ error: "وام مورد نظر پیدا نشد." }, { status: 404 });
  }
  if (loan.status === "cancelled") {
    return NextResponse.json({ error: "این وام لغو شده است." }, { status: 400 });
  }
  const row = installmentStatuses(loan).find((r) => r.number === installmentNumber);
  if (!row) {
    return NextResponse.json({ error: "قسط مورد نظر در جدول اقساط پیدا نشد." }, { status: 400 });
  }
  if (row.paid) {
    return NextResponse.json({ error: "این قسط قبلاً پرداخت شده است." }, { status: 400 });
  }

  try {
    const created = await createPaymentRequest({
      kind: "installment",
      user: guard.user,
      amount: row.amount,
      receipt,
      note,
      loanId: loan.id,
      installmentNumber,
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت پرداخت ناموفق بود." },
      { status: 400 },
    );
  }
}
