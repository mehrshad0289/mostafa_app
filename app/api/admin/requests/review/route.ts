import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reviewLoanRequest, reviewPaymentRequest } from "@/lib/db";

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
