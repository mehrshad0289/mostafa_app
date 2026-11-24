import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeUser, setPasswordLogin } from "@/lib/db";

/** بازکردن «ورود با رمز عبور» کاربر توسط ادمین */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  try {
    const user = await setPasswordLogin(id, true, guard.user.id);
    return NextResponse.json({
      user: sanitizeUser(user),
      message: `ورود با رمز عبور برای «${user.username}» فعال شد.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فعال‌سازی ورود با رمز ناموفق بود." },
      { status: 400 },
    );
  }
}
