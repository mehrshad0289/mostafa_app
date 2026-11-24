import { requireAdmin } from "@/lib/auth";
import { deleteBankMember, updateBankMember } from "@/lib/db";
import type { BankMember } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    shares?: number;
    phone?: string;
    gender?: string;
    note?: string;
  };

  const patch: Partial<Pick<BankMember, "name" | "shares" | "phone" | "gender" | "note">> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return Response.json({ error: "نام عضو الزامی است." }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.shares !== undefined) {
    const shares = Number(body.shares);
    if (!Number.isFinite(shares) || shares <= 0) {
      return Response.json(
        { error: "تعداد سهم باید عددی بزرگ‌تر از صفر باشد." },
        { status: 400 },
      );
    }
    patch.shares = shares;
  }
  if (body.gender !== undefined) {
    if (body.gender !== "male" && body.gender !== "female") {
      return Response.json(
        { error: "جنسیت باید یکی از مقادیر male یا female باشد." },
        { status: 400 },
      );
    }
    patch.gender = body.gender;
  }
  if (body.phone !== undefined) {
    patch.phone = body.phone;
  }
  if (body.note !== undefined) {
    patch.note = body.note;
  }

  const member = await updateBankMember(id, patch);
  if (!member) {
    return Response.json({ error: "عضو پیدا نشد." }, { status: 404 });
  }

  return Response.json(member);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await context.params;
  const removed = await deleteBankMember(id);

  if (!removed) {
    return Response.json({ error: "عضو پیدا نشد." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
