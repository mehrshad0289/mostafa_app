import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createLoanRequest } from "@/lib/db";

/** ثبت درخواست تسهیلات توسط کاربر عضو */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json(
      { error: "این بخش فقط برای کاربران عضو است." },
      { status: 403 },
    );
  }
  let body: { amount?: unknown; months?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  try {
    const created = await createLoanRequest({
      user: guard.user,
      amount: Number(body.amount),
      months: Number(body.months),
      reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : "",
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت درخواست ناموفق بود." },
      { status: 400 },
    );
  }
}
