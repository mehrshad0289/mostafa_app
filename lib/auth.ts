import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser, sanitizeUser, type PublicUser, type User } from "./db";

export const SESSION_COOKIE = "sessionId";

/** گزینه‌های کوکی نشست: هفت روز، httpOnly، sameSite lax؛ secure فقط روی Vercel (https) */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export type AuthGuard = { user: User } | { error: NextResponse };

/** هر کاربر لاگین‌کرده (ادمین یا عضو)؛ نبودنش خطای 401 می‌دهد */
export async function requireUser(): Promise<AuthGuard> {
  const store = await cookies();
  const user = await getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) {
    return {
      error: NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 }),
    };
  }
  return { user };
}

/** فقط ادمین؛ لاگین نبودن 401 و لاگین‌بوده غیرادمین 403 می‌دهد */
export async function requireAdmin(): Promise<AuthGuard> {
  const guard = await requireUser();
  if ("error" in guard) return guard;
  if (guard.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "فقط مدیر دسترسی دارد." }, { status: 403 }),
    };
  }
  return guard;
}

/** شکل عمومی «الان چه کسی لاگین است» برای کلاینت */
export function publicMe(user: User | null): PublicUser | null {
  return user ? sanitizeUser(user) : null;
}
