import { getBank } from "@/lib/db";

const AUDIT_LIMIT = 1000;

export async function GET(request: Request) {
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
