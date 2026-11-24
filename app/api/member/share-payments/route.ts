import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPaymentRequest } from "@/lib/db";

/** ثبت پرداخت سهام با عکس رسید — فقط کاربر عضو متصل به بانک */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json(
      { error: "این بخش فقط برای کاربران عضو است." },
      { status: 403 },
    );
  }
  let body: { amount?: unknown; receipt?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const amount = Number(body.amount);
  const receipt = typeof body.receipt === "string" ? body.receipt : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  try {
    const created = await createPaymentRequest({
      kind: "share",
      user: guard.user,
      amount,
      receipt,
      note,
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت پرداخت ناموفق بود." },
      { status: 400 },
    );
  }
}
