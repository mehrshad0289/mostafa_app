import { NextResponse } from "next/server";
import {
  SESSION_TTL_DAYS,
  createSessionToken,
  findUserByUsername,
  sanitizeUser,
  verifyPassword,
} from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

/** ورود: نام کاربری + رمز → کوکی sessionId هفت‌روزه (httpOnly, sameSite lax) + نقش کاربر */
export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "نام کاربری و رمز عبور لازم است." },
      { status: 400 },
    );
  }
  const user = await findUserByUsername(username);
  // پیام یکسان برای کاربر ناموجود و رمز اشتباه تا وضعیت حساب لو نرود
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return NextResponse.json(
      { error: "نام کاربری یا رمز عبور اشتباه است" },
      { status: 401 },
    );
  }
  if (!user.active) {
    return NextResponse.json(
      { error: "حساب شما غیرفعال است. با مدیر تماس بگیرید." },
      { status: 403 },
    );
  }
  if (!user.passwordLoginEnabled) {
    return NextResponse.json(
      { error: "ورود با رمز عبور برای حساب شما غیرفعال است. با مدیر تماس بگیرید." },
      { status: 403 },
    );
  }
  const { token, maxAgeSeconds } = createSessionToken(user, SESSION_TTL_DAYS);
  const response = NextResponse.json({ user: sanitizeUser(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSeconds));
  return response;
}
