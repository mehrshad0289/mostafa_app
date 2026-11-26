import { requireAdmin } from "@/lib/auth";
import { deleteBankAuditEntries, getBank } from "@/lib/db";

const AUDIT_LIMIT = 1000;

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("limit");
  let limit = 100;
  if (raw !== null) {
    limit = Math.floor(Number(raw));
    if (!Number.isFinite(limit) || limit < 1 || limit > AUDIT_LIMIT) {
      return Response.json(
        { error: "limit باید عددی بین ۱ تا ۱۰۰۰ باشد." },
        { status: 400 },
      );
    }
  }
  const bank = await getBank();
  return Response.json(bank.auditLog.slice(0, limit));
}

/**
 * جلسه ۴۸ — حذف سوابق به درخواست کاربر. یا ids مشخص یا all=true برای پاک‌کردن
 * همه رکوردها؛ خودِ حذف یک رکورد سابقه ثبت می‌کند. فقط ادمین.
 */
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  let body: { ids?: unknown; all?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "ورودی نامعتبر است." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const all = body.all === true;
  if (!all && ids.length === 0) {
    return Response.json(
      { error: "هیچ سابقه‌ای برای حذف انتخاب نشده است." },
      { status: 400 },
    );
  }
  const removed = await deleteBankAuditEntries({ ids, all });
  return Response.json({ removed });
}
