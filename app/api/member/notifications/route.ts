import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMemberNotifications, markMemberNotificationsSeen } from "@/lib/db";

/**
 * زنگوله اعلان‌های عضو (جلسه سی‌وهفتم):
 * GET — اعلان‌های خوانده‌نشده (نتیجهٔ بررسی درخواست‌ها + پیام مدیر)
 * POST — ثبت بازدید عضو از زنگوله (همه اعلان‌ها خوانده‌شده می‌شوند)
 */
export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json({ error: "این بخش فقط برای کاربران عضو است." }, { status: 403 });
  }
  const data = await getMemberNotifications(guard.user);
  return NextResponse.json(data);
}

export async function POST() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  if (guard.user.role !== "member") {
    return NextResponse.json({ error: "این بخش فقط برای کاربران عضو است." }, { status: 403 });
  }
  const lastSeenAt = await markMemberNotificationsSeen(guard.user);
  return NextResponse.json({ lastSeenAt });
}
