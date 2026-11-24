import { requireAdmin, requireUser } from "@/lib/auth";
import { getBank, updateBankSettings } from "@/lib/db";
import type { BankSettingsPatch } from "@/lib/db";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const bank = await getBank();
  return Response.json(bank.settings);
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const body = (await request.json()) as {
    amountPerShare?: number;
    depositTitles?: unknown;
    duplicateWarning?: unknown;
  };

  const patch: BankSettingsPatch = {};
  if (body.amountPerShare !== undefined) {
    const amountPerShare = Number(body.amountPerShare);
    if (!Number.isFinite(amountPerShare) || amountPerShare <= 0) {
      return Response.json(
        { error: "مبلغ هر سهم باید عددی بزرگ‌تر از صفر باشد." },
        { status: 400 },
      );
    }
    patch.amountPerShare = amountPerShare;
  }
  if (body.depositTitles !== undefined) {
    if (!Array.isArray(body.depositTitles)) {
      return Response.json(
        { error: "عنوان‌های واریزی باید آرایه‌ای از متن باشد." },
        { status: 400 },
      );
    }
    patch.depositTitles = (body.depositTitles as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  if (body.duplicateWarning !== undefined) {
    if (typeof body.duplicateWarning !== "boolean") {
      return Response.json(
        { error: "duplicateWarning باید true یا false باشد." },
        { status: 400 },
      );
    }
    patch.duplicateWarning = body.duplicateWarning;
  }

  const settings = await updateBankSettings(patch);
  return Response.json(settings);
}
