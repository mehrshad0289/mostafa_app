import { createBankLoan, getBank } from "@/lib/db";
import type { BankLoan } from "@/lib/db";

const LOAN_STATUSES: BankLoan["status"][] = ["active", "paid", "cancelled"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const status = searchParams.get("status") as BankLoan["status"] | null;
  const bank = await getBank();
  let loans = bank.loans;
  if (memberId) {
    loans = loans.filter((l) => l.memberId === memberId);
  }
  if (status && LOAN_STATUSES.includes(status)) {
    loans = loans.filter((l) => l.status === status);
  }
  return Response.json(loans);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    memberId?: string;
    principal?: number;
    interestAmount?: number | string;
    interestMode?: string;
    installmentCount?: number;
    firstDue?: string;
    scheduleMode?: string;
    manualText?: string;
    note?: string;
  };

  const memberId = body.memberId?.trim() ?? "";
  if (!memberId) {
    return Response.json({ error: "برای ثبت وام باید عضو انتخاب شود." }, { status: 400 });
  }
  const bank = await getBank();
  if (!bank.members.some((m) => m.id === memberId)) {
    return Response.json({ error: "عضو انتخاب‌شده پیدا نشد." }, { status: 400 });
  }
  const principal = Number(body.principal);
  if (!Number.isFinite(principal) || principal <= 0) {
    return Response.json(
      { error: "اصل وام باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }
  const interestAmount =
    body.interestAmount === undefined || body.interestAmount === ""
      ? 0
      : Number(body.interestAmount);
  if (!Number.isFinite(interestAmount) || interestAmount < 0) {
    return Response.json(
      { error: "سود وام باید عددی بزرگ‌تر یا مساوی صفر باشد." },
      { status: 400 },
    );
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
  const installmentCount = Math.floor(Number(body.installmentCount));
  if (!Number.isFinite(installmentCount) || installmentCount <= 0) {
    return Response.json(
      { error: "تعداد اقساط باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }
  if (!body.firstDue?.trim()) {
    return Response.json(
      { error: "تاریخ اولین قسط الزامی است." },
      { status: 400 },
    );
  }

  try {
    const loan = await createBankLoan({
      memberId,
      principal,
      interestAmount,
      interestMode: body.interestMode === "beginning" ? "beginning" : "end",
      installmentCount,
      firstDue: body.firstDue.trim(),
      scheduleMode: body.scheduleMode === "manual" ? "manual" : "auto",
      manualText: body.manualText,
      note: body.note,
    });
    return Response.json(loan, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ثبت وام ناموفق بود." },
      { status: 400 },
    );
  }
}
