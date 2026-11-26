import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getMemberMessages,
  markMemberMessagesSeen,
  sendMemberMessage,
} from "@/lib/db";

/**
 * پیام‌رسان عضو ↔ مدیر (جلسه ۴۹):
 * GET — پیام‌های مدیر خطاب به این عضو + پیام‌های خودش + تعداد خوانده‌نشده
 * POST — ارسال پیام جدید به مدیر
 * PATCH — ثبت بازدید عضو (همهٔ پیام‌های خطاب به او خوانده‌شده می‌شوند)
 */
export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json({ error: "این بخش فقط برای کاربران عضو است." }, { status: 403 });
  }
  const view = await getMemberMessages(guard.user);
  return NextResponse.json(view);
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json({ error: "این بخش فقط برای کاربران عضو است." }, { status: 403 });
  }
  let body: { text?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  try {
    const message = await sendMemberMessage(guard.user, text);
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ارسال پیام ناموفق بود." },
      { status: 400 },
    );
  }
}

export async function PATCH() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json({ error: "این بخش فقط برای کاربران عضو است." }, { status: 403 });
  }
  const marked = await markMemberMessagesSeen(guard.user);
  return NextResponse.json({ marked });
}
