import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * اتصال سمت سرور به Supabase (ذخیره‌سازی دائمی داده).
 * طبق مأموریت فقط از دو متغیر زیر استفاده می‌شود و Secret Key لازم نیست:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 * در نبود متغیرها (اجرای محلی بدون دیتابیس) null برگردانده می‌شود و lib/db.ts
 * مثل قبل از فایل محلی استفاده می‌کند.
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (!SB_URL || !SB_KEY) return null;
  if (client === undefined) {
    client = createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
