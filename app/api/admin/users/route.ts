import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createUser, listUsers, sanitizeUser } from "@/lib/db";

/** لیست همه کاربران — بدون hash و salt (فقط ادمین) */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const users = await listUsers();
  return NextResponse.json({ users: users.map(sanitizeUser) });
}

/** ساخت کاربر جدید؛ نام کاربری تکراری خطای واضح می‌دهد */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let body: {
    username?: unknown;
    password?: unknown;
    fullName?: unknown;
    phone?: unknown;
    role?: unknown;
    memberId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "نام کاربری و رمز عبور لازم است." },
      { status: 400 },
    );
  }
  try {
    const user = await createUser({
      username: body.username,
      password: body.password,
      fullName: typeof body.fullName === "string" ? body.fullName : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      role: body.role,
      memberId:
        typeof body.memberId === "string" && body.memberId ? body.memberId : null,
    });
    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ساخت کاربر ناموفق بود." },
      { status: 400 },
    );
  }
}
