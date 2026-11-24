import { settleBankMember, unsettleBankMember } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    claim?: number;
    debt?: number;
  };

  const claim = Number(body.claim ?? 0);
  if (!Number.isFinite(claim) || claim < 0) {
    return Response.json(
      { error: "مبلغ طلب باید عددی بزرگ‌تر یا مساوی صفر باشد." },
      { status: 400 },
    );
  }
  const debt = Number(body.debt ?? 0);
  if (!Number.isFinite(debt) || debt < 0) {
    return Response.json(
      { error: "مبلغ بدهی باید عددی بزرگ‌تر یا مساوی صفر باشد." },
      { status: 400 },
    );
  }

  const member = await settleBankMember(id, { claim, debt });
  if (!member) {
    return Response.json({ error: "عضو پیدا نشد." }, { status: 404 });
  }

  return Response.json(member);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await unsettleBankMember(id);

  if (result === null) {
    return Response.json({ error: "عضو پیدا نشد." }, { status: 404 });
  }
  if (result === false) {
    return Response.json(
      { error: "تسویه‌ای برای لغو ثبت نشده است." },
      { status: 400 },
    );
  }

  return Response.json(result);
}
