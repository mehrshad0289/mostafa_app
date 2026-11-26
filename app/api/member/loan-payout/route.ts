import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { submitLoanPayoutAccount } from "@/lib/db";

/**
 * ارسال شماره حساب/شبای عضو به مدیر برای واریز مبلغ تسهیلات —
 * فقط برای درخواست‌های تأییدشده و فقط توسط صاحب درخواست (جلسه سی‌وششم).
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json(
      { error: "این بخش فقط برای کاربران عضو است." },
      { status: 403 },
    );
  }
  let body: { requestId?: unknown; holder?: unknown; cardNumber?: unknown; sheba?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) {
    return NextResponse.json(
      { error: "شناسه درخواست تسهیلات الزامی است." },
      { status: 400 },
    );
  }
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  try {
    const payout = await submitLoanPayoutAccount({
      userId: guard.user.id,
      requestId,
      holder: text(body.holder),
      cardNumber: text(body.cardNumber),
      sheba: text(body.sheba),
      note: text(body.note),
    });
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ارسال شماره حساب ناموفق بود." },
      { status: 400 },
    );
  }
}
