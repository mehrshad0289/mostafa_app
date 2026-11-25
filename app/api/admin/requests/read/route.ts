import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { markRequestsRead } from "@/lib/db";

/** ثبت بازدید ادمین از صفحه درخواست‌ها — همه درخواست‌های pending تا الان «خوانده‌شده» می‌شوند */
export async function POST() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const lastReadAt = await markRequestsRead();
  return NextResponse.json({ lastReadAt });
}
