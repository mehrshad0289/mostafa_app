import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

/** خروج: پاک کردن کوکی نشست؛ توکن بدون حالت است و پاک‌سازی سمت سرور لازم ندارد */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
