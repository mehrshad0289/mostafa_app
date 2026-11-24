import { NextResponse } from "next/server";
import {
  ADMIN_USERNAME,
  SESSION_TTL_DAYS,
  createSessionToken,
  findUserByUsername,
  sanitizeUser,
  verifyPassword,
} from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

/**
 * ورود بدون رمز برای ادمین اصلی (username=admin) — «فعلاً» فعال است تا ورود سریع
 * داشته باشیم. برای بستن دوباره فقط این مقدار را false کنید؛ رمز قبلی ادمین دست
 * نخورده باقی می‌ماند و همان موقع به‌عنوان لایه دوم برمی‌گردد. توجه: این اپ روی
 * اینترنت عمومی است؛ تا وقتی true است هر کسی می‌تواند به‌عنوان admin وارد شود.
 */
const ADMIN_PASSWORDLESS_LOGIN = true;

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
  const passwordlessAdmin =
    ADMIN_PASSWORDLESS_LOGIN && username.toLowerCase() === ADMIN_USERNAME;
  if (!username || (!password && !passwordlessAdmin)) {
    return NextResponse.json(
      { error: "نام کاربری و رمز عبور لازم است." },
      { status: 400 },
    );
  }
  const user = await findUserByUsername(username);
  // ورود بدون رمز فقط برای ادمین اصلی فعال؛ بقیه باید رمز درست بدهند
  const passwordlessOk = passwordlessAdmin && password === "";
  // پیام یکسان برای کاربر ناموجود و رمز اشتباه تا وضعیت حساب لو نرود
  if (!user || (!passwordlessOk && !verifyPassword(password, user.salt, user.passwordHash))) {
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
  if (!passwordlessOk && !user.passwordLoginEnabled) {
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
