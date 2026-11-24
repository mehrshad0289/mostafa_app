import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeUser, setUserActive } from "@/lib/db";

/**
 * غیرفعال‌سازی حساب کاربر توسط ادمین — ادمین نمی‌تواند خودش را غیرفعال کند و
 * آخرین ادمین فعال همیشه باقی می‌ماند. نشست‌های فعال کاربر بلافاصله باطل می‌شوند.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  try {
    const user = await setUserActive(id, false, guard.user.id);
    return NextResponse.json({
      user: sanitizeUser(user),
      message: `حساب «${user.username}» غیرفعال شد.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "غیرفعال‌سازی حساب ناموفق بود." },
      { status: 400 },
    );
  }
}
