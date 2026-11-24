import { NextResponse } from "next/server";
import { registerUser, sanitizeUser } from "@/lib/db";

/**
 * ثبت‌نام عمومی: نام کاربری + رمز → حساب عضوِ «غیرفعال» که ادمین آن را فعال می‌کند.
 * ورود تا فعال‌سازی حساب ممکن نیست.
 */
export async function POST(request: Request) {
  let body: {
    username?: unknown;
    password?: unknown;
    fullName?: unknown;
    phone?: unknown;
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
    const user = await registerUser({
      username: body.username,
      password: body.password,
      fullName: typeof body.fullName === "string" ? body.fullName : "",
      phone: typeof body.phone === "string" ? body.phone : "",
    });
    return NextResponse.json(
      {
        ok: true,
        user: sanitizeUser(user),
        message:
          "ثبت‌نام انجام شد. حساب شما پس از فعال‌سازی توسط مدیر قابل ورود خواهد بود.",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت‌نام ناموفق بود." },
      { status: 400 },
    );
  }
}
