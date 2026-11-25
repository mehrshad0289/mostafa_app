import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteUser, sanitizeUser, updateUser, type UserPatch } from "@/lib/db";

/** ویرایش کاربر: نام، تلفن، نقش، وضعیت فعال، رمز جدید، اتصال به عضو */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  let body: UserPatch;
  try {
    body = (await request.json()) as UserPatch;
  } catch {
    return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  try {
    // guard.user.id → ادمین نمی‌تواند حساب خودش را غیرفعال یا ورود با رمزش را ببندد
    const user = await updateUser(id, body, guard.user.id);
    if (!user) {
      return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
    }
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ویرایش کاربر ناموفق بود." },
      { status: 400 },
    );
  }
}

/** حذف کاربر؛ حذف حساب خودِ ادمین و آخرین ادمین فعال ممنوع است */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  if (id === guard.user.id) {
    return NextResponse.json(
      { error: "حذف حساب خودتان ممکن نیست؛ ابتدا با حساب دیگری وارد شوید." },
      { status: 400 },
    );
  }
  try {
    const user = await deleteUser(id);
    if (!user) {
      return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
    }
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "حذف کاربر ناموفق بود." },
      { status: 400 },
    );
  }
}
