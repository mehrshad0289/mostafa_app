import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  SESSION_TTL_DAYS,
  createSession,
  findUserByUsername,
  sanitizeUser,
  verifyPassword,
} from "@/lib/db";

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
  if (
    !user ||
    !user.active ||
    !verifyPassword(password, user.salt, user.passwordHash)
  ) {
    return NextResponse.json(
      { error: "نام کاربری یا رمز عبور اشتباه است" },
      { status: 401 },
    );
  }
  const session = await createSession(user.id);
  const response = NextResponse.json({ user: sanitizeUser(user) });
  response.cookies.set(
    SESSION_COOKIE,
    session.id,
    sessionCookieOptions(SESSION_TTL_DAYS * 24 * 60 * 60),
  );
  return response;
}
