import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, publicMe } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";

/** الان چه کسی لاگین است؛ لاگین نبودن = user خالی (null) */
export async function GET() {
  const store = await cookies();
  const user = await getSessionUser(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user: publicMe(user) });
}
