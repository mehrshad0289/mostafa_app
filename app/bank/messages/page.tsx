"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import MessagesTab from "@/app/components/bank/MessagesTab";

/**
 * بخش «پیام‌ها» — پیام‌رسان مدیر ↔ اعضا (جلسه ۴۹): مدیر اطلاعات/پیام را برای
 * همهٔ اعضا یا اعضای منتخب می‌فرستد و پیام‌های اعضا را همین‌جا می‌خواند.
 * ناوبری بین بخش‌ها از منوی پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankMessagesPage() {
  return (
    <AdminShell>
      <BankSection title="پیام‌ها" subtitle="ارسال اطلاعات و پیام به اعضا و خواندن پیام‌های اعضا" icon="note">
        <MessagesTab />
      </BankSection>
    </AdminShell>
  );
}
