import { requireAdmin, requireUser } from "@/lib/auth";
import { getBank, listUserRequests, updateBankSettings } from "@/lib/db";
import type { BankSettingsPatch, DepositAccount, LoanPayoutAccount } from "@/lib/db";
import { normalizeDigits } from "@/lib/bank";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const bank = await getBank();
  // حساب‌های واریز تسهیلات اعضا (شبا/کارت) اطلاعات شخصی است — ادمین همه را
  // می‌بیند، ولی عضو فقط ارسال‌های خودش (جلسه سی‌وششم).
  if (guard.user.role === "admin") {
    return Response.json(bank.settings);
  }
  const own: Record<string, LoanPayoutAccount> = {};
  const requests = await listUserRequests(guard.user.id);
  for (const r of requests.loanRequests) {
    const payout = bank.settings.loanPayoutAccounts?.[r.id];
    if (payout) own[r.id] = payout;
  }
  return Response.json({ ...bank.settings, loanPayoutAccounts: own });
}


export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const body = (await request.json()) as {
    amountPerShare?: number;
    depositTitles?: unknown;
    duplicateWarning?: unknown;
    depositAccounts?: unknown;
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
  if (body.depositAccounts !== undefined) {
    const raw =
      body.depositAccounts && typeof body.depositAccounts === "object"
        ? (body.depositAccounts as Record<string, unknown>)
        : {};
    const parseAccount = (value: unknown, label: string): DepositAccount => {
      const a = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 60) : "");
      const digits = (v: unknown) =>
        normalizeDigits(typeof v === "string" ? v : "").replace(/[\s-]/g, "");
      const card = digits(a.cardNumber);
      if (card && !/^\d{16}$/.test(card)) {
        throw new Error(`${label} — شماره کارت باید ۱۶ رقم باشد.`);
      }
      const sheba = digits(a.sheba).toUpperCase();
      if (sheba && !/^IR\d{24}$/.test(sheba)) {
        throw new Error(`${label} — شماره شبا باید IR و ۲۴ رقم باشد.`);
      }
      return { holder: text(a.holder), cardNumber: card, sheba };
    };
    try {
      patch.depositAccounts = {
        primary: parseAccount(raw.primary, "حساب اصلی"),
        alternate: parseAccount(raw.alternate, "حساب جایگزین"),
      };
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "اطلاعات حساب نامعتبر است." },
        { status: 400 },
      );
    }
  }

  const settings = await updateBankSettings(patch);
  return Response.json(settings);
}
