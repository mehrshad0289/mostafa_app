"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /bank دیگر صفحه ندارند — از جلسه ۲۷ هر بخش بانک صفحه مستقل «یک‌تیکه» دارد:
 * /bank/members و /bank/transactions و /bank/loans و /bank/reports و
 * /bank/settings و /bank/audit. این صفحه فقط لینک‌های قدیمی را می‌سازد:
 * /bank بدون tab به «اعضا» می‌رود و ?tab=X به بخش خودش.
 * (خواندن ?tab= مثل قبل بعد از mount از window.location است تا صفحه قابل
 * prerender بماند — با cacheComponents سازگار.)
 */

const TAB_ROUTES: Record<string, string> = {
  members: "members",
  deposits: "transactions",
  loans: "loans",
  reports: "reports",
  settings: "settings",
  audit: "audit",
};

export default function BankIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab") || "";
    router.replace(`/bank/${TAB_ROUTES[param] || "members"}`);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black dark:text-zinc-50">
      <p className="text-sm text-zinc-500">در حال باز کردن فم بانک…</p>
    </main>
  );
}
