import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reviewLoanRequest, reviewPaymentRequest, updateLoanRequest } from "@/lib/db";

/** تأیید/رد درخواست پرداخت یا تسهیلات توسط ادمین */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let body: { kind?: unknown; id?: unknown; action?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const kind = body.kind === "payment" || body.kind === "loan" ? body.kind : null;
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  const id = typeof body.id === "string" ? body.id : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
  if (!kind || !action || !id) {
    return NextResponse.json(
      { error: "kind، id و action لازم است." },
      { status: 400 },
    );
  }
  try {
    if (kind === "payment") {
      const updated = await reviewPaymentRequest(id, action, note);
      return NextResponse.json({ request: updated });
    }
    const updated = await reviewLoanRequest(id, action, note);
    return NextResponse.json({ request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "بررسی درخواست ناموفق بود." },
      { status: 400 },
    );
  }
}

/** ویرایش درخواست تسهیلات معلق توسط ادمین (مبلغ / مدت / دلیل) */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let body: { id?: unknown; amount?: unknown; months?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id لازم است." }, { status: 400 });
  }
  const patch: { amount?: number; months?: number; reason?: string } = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "مبلغ نامعتبر است." }, { status: 400 });
    }
    patch.amount = amount;
  }
  if (body.months !== undefined) {
    const months = Number(body.months);
    if (!Number.isFinite(months)) {
      return NextResponse.json({ error: "مدت بازپرداخت نامعتبر است." }, { status: 400 });
    }
    patch.months = months;
  }
  if (body.reason !== undefined) {
    if (typeof body.reason !== "string") {
      return NextResponse.json({ error: "دلیل باید متن باشد." }, { status: 400 });
    }
    patch.reason = body.reason.slice(0, 1000);
  }
  try {
    const updated = await updateLoanRequest(id, patch);
    return NextResponse.json({ request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ویرایش درخواست ناموفق بود." },
      { status: 400 },
    );
  }
}
