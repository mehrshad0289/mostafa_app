import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminMessagesOverview,
  listUsers,
  markMemberInboxRead,
  sendAdminMessage,
} from "@/lib/db";

/**
 * پیام‌رسان مدیر ↔ اعضا (جلسه ۴۹):
 * GET — همه پیام‌های ارسال‌شدهٔ مدیر + صندوق پیام‌های اعضا + فهرست گیرنده‌های ممکن
 * POST — ارسال پیام جدید به «همه اعضا» یا اعضای منتخب
 * PATCH — علامت‌گذاری همهٔ پیام‌های اعضا به‌عنوان خوانده‌شده
 */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const [overview, users] = await Promise.all([getAdminMessagesOverview(), listUsers()]);
  const recipients = users
    .filter((u) => u.role === "member" && u.active)
    .map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      memberId: u.memberId,
    }));
  return NextResponse.json({ ...overview, recipients });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let body: { text?: unknown; recipients?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const recipients =
    body.recipients === "all" || Array.isArray(body.recipients) ? body.recipients : null;
  if (!recipients) {
    return NextResponse.json({ error: "گیرنده‌های پیام مشخص نشده است." }, { status: 400 });
  }
  try {
    const message = await sendAdminMessage({ text, recipients });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ارسال پیام ناموفق بود." },
      { status: 400 },
    );
  }
}

export async function PATCH() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const marked = await markMemberInboxRead();
  return NextResponse.json({ marked });
}
