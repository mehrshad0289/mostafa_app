import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listUserRequests } from "@/lib/db";

/** درخواست‌های خود کاربر (پرداخت‌ها با رسید + درخواست‌های تسهیلات) */
export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const data = await listUserRequests(guard.user.id);
  return NextResponse.json(data);
}
