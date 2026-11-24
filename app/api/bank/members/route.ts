import { requireAdmin, requireUser } from "@/lib/auth";
import { createBankMember, getBank } from "@/lib/db";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const bank = await getBank();
  // عضو عادی فقط رکورد خودش را می‌بیند؛ فیلتر سمت سرور است و با query عوض نمی‌شود
  if (guard.user.role === "member") {
    const scopeId = guard.user.memberId ?? "__none__";
    return Response.json(bank.members.filter((m) => m.id === scopeId));
  }
  return Response.json(bank.members);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const body = (await request.json()) as {
    name?: string;
    shares?: number;
    phone?: string;
    gender?: string;
    note?: string;
  };
  const name = body.name?.trim() ?? "";
  if (!name) {
    return Response.json({ error: "نام عضو الزامی است." }, { status: 400 });
  }
  const shares = Number(body.shares);
  if (!Number.isFinite(shares) || shares <= 0) {
    return Response.json(
      { error: "تعداد سهم باید عددی بزرگ‌تر از صفر باشد." },
      { status: 400 },
    );
  }

  const member = await createBankMember({
    name,
    shares,
    phone: body.phone ?? "",
    gender: body.gender === "female" ? "female" : "male",
    note: body.note ?? "",
  });

  return Response.json(member, { status: 201 });
}
