import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminResetPassword, sanitizeUser } from "@/lib/db";

/**
 * ریست رمز عبور کاربر توسط ادمین: با «password» در بدنه رمز جدید تنظیم می‌شود؛
 * بدون آن یک رمز موقت تولید و در پاسخ برگردانده می‌شود (tempPassword).
 * همه نشست‌های قبلی کاربر با تغییر رمز باطل می‌شوند.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    body = {};
  }
  const newPassword = typeof body.password === "string" ? body.password : undefined;
  try {
    const { user, generated, tempPassword } = await adminResetPassword(id, newPassword);
    return NextResponse.json({
      user: sanitizeUser(user),
      tempPassword,
      message: generated
        ? `رمز «${user.username}» ریست شد؛ رمز موقت: ${tempPassword}`
        : `رمز «${user.username}» عوض شد.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ریست رمز عبور ناموفق بود." },
      { status: 400 },
    );
  }
}
