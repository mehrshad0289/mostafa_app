import { deleteBankDeposit, getBank, normalizeDepositType, updateBankDeposit } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    type?: string;
    memberId?: string | null;
    memberName?: string;
    title?: string;
    amount?: number;
    periodKey?: string;
  };

  let type;
  if (body.type !== undefined) {
    type = normalizeDepositType(body.type);
    if (!type) {
      return Response.json(
        { error: "نوع واریزی باید یکی از مقادیر share، loan_interest، profit یا misc باشد." },
        { status: 400 },
      );
    }
  }
  let amount;
  if (body.amount !== undefined) {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: "مبلغ واریزی باید عددی بزرگ‌تر از صفر باشد." },
        { status: 400 },
      );
    }
  }

  const bank = await getBank();
  const current = bank.deposits.find((d) => d.id === id);
  if (!current) {
    return Response.json({ error: "واریزی پیدا نشد." }, { status: 404 });
  }

  const memberId = body.memberId?.trim() || null;
  if (body.memberId !== undefined && memberId) {
    if (!bank.members.some((m) => m.id === memberId)) {
      return Response.json({ error: "عضو انتخاب‌شده پیدا نشد." }, { status: 400 });
    }
  }
  const nextType = type ?? current.type;
  const nextMemberId = body.memberId !== undefined ? memberId : current.memberId;
  if (nextType === "share" && !nextMemberId) {
    return Response.json(
      { error: "برای واریز سهام باید عضو انتخاب شود." },
      { status: 400 },
    );
  }

  const deposit = await updateBankDeposit(id, {
    type,
    memberId: body.memberId !== undefined ? memberId : undefined,
    memberName: body.memberName,
    title: body.title,
    amount,
    periodKey: body.periodKey,
  });
  if (!deposit) {
    return Response.json({ error: "واریزی پیدا نشد." }, { status: 404 });
  }

  return Response.json(deposit);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const removed = await deleteBankDeposit(id);

  if (!removed) {
    return Response.json({ error: "واریزی پیدا نشد." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
