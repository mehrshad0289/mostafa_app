import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateUserPassword, verifyPassword } from "@/lib/db";

/** تغییر رمز توسط خود کاربر — فقط با رمز فعلی درست */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "رمز فعلی و رمز جدید لازم است." },
      { status: 400 },
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "رمز جدید باید حداقل ۶ نویسه باشد." },
      { status: 400 },
    );
  }
  const user = guard.user;
  if (!verifyPassword(currentPassword, user.salt, user.passwordHash)) {
    return NextResponse.json({ error: "رمز فعلی درست نیست." }, { status: 400 });
  }
  await updateUserPassword(user.id, newPassword);
  return NextResponse.json({ ok: true });
}
