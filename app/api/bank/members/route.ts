import { createBankMember, getBank } from "@/lib/db";

export async function GET() {
  const bank = await getBank();
  return Response.json(bank.members);
}

export async function POST(request: Request) {
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
