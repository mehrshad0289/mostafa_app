import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllRequests } from "@/lib/db";

/** همه درخواست‌های عضو برای پنل ادمین */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const data = await listAllRequests();
  return NextResponse.json(data);
}
