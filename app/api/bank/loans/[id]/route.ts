import { requireAdmin } from "@/lib/auth";
import { deleteBankLoan, updateBankLoan } from "@/lib/db";
import type { BankLoan, BankLoanPatch } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const LOAN_STATUSES: BankLoan["status"][] = ["active", "paid", "cancelled"];

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const body = (await request.json()) as {
    note?: string;
    status?: string;
    principal?: number;
    interestAmount?: number;
    interestMode?: string;
    installmentCount?: number;
    firstDue?: string;
    scheduleMode?: string;
    manualText?: string;
  };

  const patch: BankLoanPatch = {};
  if (body.status !== undefined) {
    if (!LOAN_STATUSES.includes(body.status as BankLoan["status"])) {
      return Response.json(
        { error: "وضعیت وام باید یکی از مقادیر active، paid یا cancelled باشد." },
        { status: 400 },
      );
    }
    patch.status = body.status as BankLoan["status"];
  }
  if (body.note !== undefined) {
    patch.note = body.note;
  }
  if (body.principal !== undefined) {
    const principal = Number(body.principal);
    if (!Number.isFinite(principal) || principal <= 0) {
      return Response.json(
        { error: "اصل وام باید عددی بزرگ‌تر از صفر باشد." },
        { status: 400 },
      );
    }
    patch.principal = principal;
  }
  if (body.interestAmount !== undefined) {
    const interestAmount = Number(body.interestAmount);
    if (!Number.isFinite(interestAmount) || interestAmount < 0) {
      return Response.json(
        { error: "سود وام باید عددی بزرگ‌تر یا مساوی صفر باشد." },
        { status: 400 },
      );
    }
    patch.interestAmount = interestAmount;
  }
  if (
    body.interestMode !== undefined &&
    body.interestMode !== "beginning" &&
    body.interestMode !== "end"
  ) {
    return Response.json(
      { error: "حالت سود باید یکی از مقادیر beginning یا end باشد." },
      { status: 400 },
    );
  }
  if (body.interestMode !== undefined) {
    patch.interestMode = body.interestMode === "beginning" ? "beginning" : "end";
  }
  if (body.installmentCount !== undefined) {
    const installmentCount = Math.floor(Number(body.installmentCount));
    if (!Number.isFinite(installmentCount) || installmentCount <= 0) {
      return Response.json(
        { error: "تعداد اقساط باید عددی بزرگ‌تر از صفر باشد." },
        { status: 400 },
      );
    }
    patch.installmentCount = installmentCount;
  }
  if (body.firstDue !== undefined) {
    patch.firstDue = body.firstDue.trim();
  }
  if (body.scheduleMode !== undefined) {
    patch.scheduleMode = body.scheduleMode === "manual" ? "manual" : "auto";
  }
  if (body.manualText !== undefined) {
    patch.manualText = body.manualText;
  }

  try {
    const loan = await updateBankLoan(id, patch);
    if (!loan) {
      return Response.json({ error: "وام پیدا نشد." }, { status: 404 });
    }
    return Response.json(loan);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ویرایش وام ناموفق بود." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const removed = await deleteBankLoan(id);

  if (!removed) {
    return Response.json({ error: "وام پیدا نشد." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
