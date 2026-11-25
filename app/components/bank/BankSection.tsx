"use client";

import { useState } from "react";
import ClayIcon, { type ClayIconName } from "@/app/components/mobile/ClayIcon";
import ManagerLock from "./ManagerLock";

type BankSectionProps = {
  /** عنوان بخش — مثل «تراکنش‌ها» */
  title: string;
  /** توضیح کوتاه زیر عنوان */
  subtitle?: string;
  icon: ClayIconName;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
};

/**
 * قاب مشترک صفحه‌های مستقل بخش‌های بانک (جلسه ۲۷ — «هر بخش یک‌تیکه»):
 * فقط عنوان همان بخش + محتوای مرتبط با آن. هیچ تب دیگری، لینک بازگشت به
 * Mostafa App یا جعبه موجودی در این صفحه‌ها نیست — ناوبری بین بخش‌ها از
 * منوی پنل مدیریت (AdminShell) انجام می‌شود، مثل «مدیریت کاربران».
 * دکمه «قفل مدیر» (استپ ۱۵) مثل قبل سر جایش است.
 */
export default function BankSection({
  title,
  subtitle,
  icon,
  loading = false,
  error = null,
  children,
}: BankSectionProps) {
  const [locked, setLocked] = useState(false);

  if (locked) return <ManagerLock onUnlock={() => setLocked(false)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClayIcon name={icon} size={44} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setLocked(true)} className="btn-outline">
          قفل مدیر
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-500">در حال دریافت اطلاعات…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {children}
    </div>
  );
}
