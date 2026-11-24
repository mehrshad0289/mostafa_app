import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeUser, setPasswordLogin } from "@/lib/db";

/**
 * بستن «ورود با رمز عبور» کاربر توسط ادمین — ادمین نمی‌تواند ورود با رمز خودش
 * را ببندد. تغییر فوری اعمال می‌شود و نشست‌های فعال کاربر بلافاصله باطل می‌شوند.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  try {
    const user = await setPasswordLogin(id, false, guard.user.id);
    return NextResponse.json({
      user: sanitizeUser(user),
      message: `ورود با رمز عبور برای «${user.username}» غیرفعال شد.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "غیرفعال‌سازی ورود با رمز ناموفق بود." },
      { status: 400 },
    );
  }
}
