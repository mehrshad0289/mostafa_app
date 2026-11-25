import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { storageMode } from "@/lib/db";

/**
 * وضعیت ذخیره‌سازی برای هشدار پنل ادمین.
 * mode = "supabase" یعنی داده دائمی در دیتابیس Supabase ذخیره می‌شود.
 * mode = "file" یعنی متغیرهای Supabase تنظیم نشده و داده در فایل موقت سرور
 * (/tmp روی Vercel) نگه‌داری می‌شود و با سرد شدن سرور پاک می‌شود.
 */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const mode = storageMode();
  return NextResponse.json({ mode, persistent: mode === "supabase" });
}
