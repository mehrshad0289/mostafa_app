// انواع تراکنش‌های بانک — ماژول client-safe (بدون I/O): کامپوننت‌های مرورگر
// این تایپ‌ها را از این‌جا import می‌کنند تا lib/db.ts (با fs/promises — فقط سرور)
// به باندل مرورگر کشیده نشود (جلسه ۵۹).

/** انواع تراکنش واریزی/برداشت فم بانک.
 *  جلسه ۵۸: نوع withdraw_misc (برداشت متفرقهٔ ثبت‌شدهٔ مدیر از حساب عضو/بانک).
 *  جلسه ۵۹ (به درخواست کاربر): انواع «پرداخت قسط» و برداشت‌های دسته‌ای اضافه شدند —
 *  در فرم ثبت تراکنش، هر دو گروه واریز و برداشت همان دسته‌ها را دارند:
 *  واریز: پرداخت سهام (share)، پرداخت قسط (installment)، سود بانک (profit)، متفرقه (misc)
 *  برداشت: برداشت سهام (withdraw_share)، برداشت قسط (withdraw_installment)،
 *  برداشت سود بانک (withdraw_profit)، برداشت متفرقه (withdraw_misc).
 *  رکوردهای withdraw_* برداشت‌اند: مبلغ همیشه مثبت ذخیره می‌شود و جهت از خودِ نوع درمی‌آید. */
export type BankDepositType =
  | "share"
  | "loan_interest"
  | "profit"
  | "misc"
  | "installment"
  | "withdraw_misc"
  | "withdraw_share"
  | "withdraw_installment"
  | "withdraw_profit";

/** انواع برداشت — رکورد واریزی با معنای برداشت (مبلغ مثبت، اثر منفی روی مانده‌ها) */
const WITHDRAW_TYPES: BankDepositType[] = [
  "withdraw_misc",
  "withdraw_share",
  "withdraw_installment",
  "withdraw_profit",
];

/** برداشت نوع‌های withdraw_* یک رکورد واریزی با علامت معکوس‌اند — مبلغ همیشه مثبت ذخیره می‌شود */
export function isWithdrawType(type: BankDepositType): boolean {
  return WITHDRAW_TYPES.includes(type);
}

/** همهٔ انواع مجاز تراکنش — برای نرمال‌سازی ورودی API و اعتبارسنجی پشتیبان */
export const BANK_DEPOSIT_TYPES: BankDepositType[] = [
  "share",
  "loan_interest",
  "profit",
  "misc",
  "installment",
  "withdraw_misc",
  "withdraw_share",
  "withdraw_installment",
  "withdraw_profit",
];

export function normalizeDepositType(value: unknown): BankDepositType | null {
  return BANK_DEPOSIT_TYPES.includes(value as BankDepositType)
    ? (value as BankDepositType)
    : null;
}
