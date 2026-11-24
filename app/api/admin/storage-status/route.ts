import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { storageMode } from "@/lib/db";

/**
 * وضعیت ذخیره‌سازی برای هشدار پنل ادمین.
 * mode = "file" یعنی روی Vercel داده در /tmp موقتی است و با سرد شدن سرور
 * پاک می‌شود (اعضا/کاربران ساخته‌شده از بین می‌روند) — تا KV متصل شود.
 */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const mode = storageMode();
  return NextResponse.json({ mode, persistent: mode === "kv" });
}
