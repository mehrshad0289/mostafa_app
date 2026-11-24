import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeUser, setUserActive } from "@/lib/db";

/** فعال‌سازی حساب کاربر توسط ادمین — پس از آن کاربر می‌تواند وارد شود */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  try {
    const user = await setUserActive(id, true, guard.user.id);
    return NextResponse.json({
      user: sanitizeUser(user),
      message: `حساب «${user.username}» فعال شد.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فعال‌سازی حساب ناموفق بود." },
      { status: 400 },
    );
  }
}
