import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUnreadRequests, listAllRequests } from "@/lib/db";

/** همه درخواست‌های عضو برای پنل ادمین + زمان آخرین بازدید ادمین (مبنای نشان «خوانده‌نشده») */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const [data, unread] = await Promise.all([listAllRequests(), getUnreadRequests()]);
  return NextResponse.json({
    ...data,
    lastReadAt: unread.lastReadAt,
    unreadCount: unread.count,
  });
}
