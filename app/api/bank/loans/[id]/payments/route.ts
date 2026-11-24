import { requireAdmin } from "@/lib/auth";
import { addBankLoanPayment, deleteBankLoanPayment } from "@/lib/db";
import { jalaliToDate, loanRemaining } from "@/lib/bank";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const body = (await request.json()) as {
    amount?: number;
    paidAt?: string;
    note?: string;
  };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      { error: "مبلغ پرداخت باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }

  let paidAt = new Date().toISOString();
  if (body.paidAt?.trim()) {
    const direct = new Date(body.paidAt.trim());
    if (!Number.isNaN(direct.getTime())) {
      paidAt = direct.toISOString();
    } else {
      const jalali = jalaliToDate(body.paidAt.trim());
      if (!jalali) {
        return Response.json(
          { error: "تاریخ پرداخت معتبر نیست (میلادی ISO یا شمسی ۱۴۰۵/۰۸/۲۷)." },
          { status: 400 },
        );
      }
      paidAt = jalali.toISOString();
    }
  }

  const result = await addBankLoanPayment(id, { amount, paidAt, note: body.note });
  if (!result) {
    return Response.json({ error: "وام پیدا نشد." }, { status: 404 });
  }

  return Response.json({
    payment: result.payment,
    loan: result.loan,
    status: result.loan.status,
    remaining: loanRemaining(result.loan),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("paymentId")?.trim() ?? "";
  if (!paymentId) {
    return Response.json(
      { error: "شناسه پرداخت (paymentId) لازم است." },
      { status: 400 },
    );
  }

  const result = await deleteBankLoanPayment(id, paymentId);
  if (!result) {
    return Response.json({ error: "پرداخت پیدا نشد." }, { status: 404 });
  }

  return Response.json({
    ok: true,
    status: result.loan.status,
    remaining: loanRemaining(result.loan),
  });
}
