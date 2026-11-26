import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUnreadRequests } from "@/lib/db";

/** شمارش درخواست‌های خوانده‌نشده برای اعلان (زنگ) پنل ادمین — سبک، بدون فیلد رسید */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const unread = await getUnreadRequests();
  return NextResponse.json({
    count: unread.count,
    paymentCount: unread.paymentCount,
    loanCount: unread.loanCount,
    // جلسه ۳۷: حساب‌های شبا/کارت ارسال‌شدهٔ اعضا هم در زنگ ادمین شمرده می‌شوند
    payoutCount: unread.payoutCount,
    payouts: unread.payouts,
    lastReadAt: unread.lastReadAt,
    paymentRequests: unread.paymentRequests.map(({ receipt, ...rest }) => {
      void receipt;
      return rest;
    }),
    loanRequests: unread.loanRequests,
  });
}
