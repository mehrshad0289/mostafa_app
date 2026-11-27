import { requireAdmin, requireUser } from "@/lib/auth";
import { createBankDeposits, getBank, normalizeDepositType } from "@/lib/db";

export async function GET(request: Request) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const type = normalizeDepositType(searchParams.get("type"));
  const bank = await getBank();
  let deposits = bank.deposits;
  // عضو عادی فقط واریزی‌های خودش را می‌بیند؛ memberId کوئری نادیده گرفته می‌شود
  if (guard.user.role === "member") {
    const scopeId = guard.user.memberId ?? "__none__";
    deposits = deposits.filter((d) => d.memberId === scopeId);
  } else if (memberId) {
    deposits = deposits.filter((d) => d.memberId === memberId);
  }
  if (type) {
    deposits = deposits.filter((d) => d.type === type);
  }
  return Response.json(deposits);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const body = (await request.json()) as {
    type?: string;
    /** جلسه ۵۸ — یک یا چند عضو یا همهٔ اعضا؛ memberId تک‌مقداری قدیمی هم پذیرفته می‌شود */
    memberIds?: string[] | null;
    memberId?: string | null;
    splitMode?: string;
    memberName?: string;
    title?: string;
    amount?: number;
    periodKey?: string;
  };

  const type = normalizeDepositType(body.type);
  if (!type) {
    return Response.json(
      {
        error:
          "نوع تراکنش باید یکی از مقادیر share، installment، loan_interest، profit، misc، withdraw_share، withdraw_installment، withdraw_profit یا withdraw_misc باشد.",
      },
      { status: 400 },
    );
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      { error: "مبلغ تراکنش باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }
  const splitMode = body.splitMode === "total" ? ("total" as const) : ("perMember" as const);

  const rawIds = Array.isArray(body.memberIds)
    ? body.memberIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  if (rawIds.length === 0 && typeof body.memberId === "string" && body.memberId.trim()) {
    rawIds.push(body.memberId.trim());
  }
  const memberIds = [...new Set(rawIds)];
  // جلسه ۵۹ — سهام و پرداخت قسط (واریز) و برداشت سهام/قسط بدون عضو معنا ندارند
  if (
    (type === "share" ||
      type === "installment" ||
      type === "withdraw_share" ||
      type === "withdraw_installment") &&
    memberIds.length === 0
  ) {
    return Response.json(
      {
        error:
          type === "share"
            ? "برای واریز سهام باید عضو انتخاب شود."
            : type === "installment"
              ? "برای ثبت پرداخت قسط باید عضو انتخاب شود."
              : type === "withdraw_share"
                ? "برای برداشت سهام باید عضو انتخاب شود."
                : "برای برداشت قسط باید عضو انتخاب شود.",
      },
      { status: 400 },
    );
  }
  if (memberIds.length > 0) {
    const bank = await getBank();
    if (!memberIds.every((id) => bank.members.some((m) => m.id === id))) {
      return Response.json({ error: "عضو انتخاب‌شده پیدا نشد." }, { status: 400 });
    }
  }
  if (memberIds.length > 1 && splitMode === "total" && amount < memberIds.length) {
    return Response.json(
      { error: "مبلغ کل برای تقسیم مساوی بین همهٔ اعضا کافی نیست." },
      { status: 400 },
    );
  }

  const created = await createBankDeposits({
    type,
    memberIds: memberIds.length > 0 ? memberIds : null,
    splitMode,
    memberName: body.memberName,
    title: body.title,
    amount,
    periodKey: body.periodKey,
  });

  return Response.json(created, { status: 201 });
}
