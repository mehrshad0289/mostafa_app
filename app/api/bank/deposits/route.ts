import { createBankDeposit, getBank, normalizeDepositType } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const type = normalizeDepositType(searchParams.get("type"));
  const bank = await getBank();
  let deposits = bank.deposits;
  if (memberId) {
    deposits = deposits.filter((d) => d.memberId === memberId);
  }
  if (type) {
    deposits = deposits.filter((d) => d.type === type);
  }
  return Response.json(deposits);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: string;
    memberId?: string | null;
    memberName?: string;
    title?: string;
    amount?: number;
    periodKey?: string;
  };

  const type = normalizeDepositType(body.type);
  if (!type) {
    return Response.json(
      { error: "نوع واریزی باید یکی از مقادیر share، loan_interest، profit یا misc باشد." },
      { status: 400 },
    );
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      { error: "مبلغ واریزی باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }
  const memberId = body.memberId?.trim() || null;
  if (type === "share" && !memberId) {
    return Response.json(
      { error: "برای واریز سهام باید عضو انتخاب شود." },
      { status: 400 },
    );
  }
  if (memberId) {
    const bank = await getBank();
    if (!bank.members.some((m) => m.id === memberId)) {
      return Response.json({ error: "عضو انتخاب‌شده پیدا نشد." }, { status: 400 });
    }
  }

  const deposit = await createBankDeposit({
    type,
    memberId,
    memberName: body.memberName,
    title: body.title,
    amount,
    periodKey: body.periodKey,
  });

  return Response.json(deposit, { status: 201 });
}
