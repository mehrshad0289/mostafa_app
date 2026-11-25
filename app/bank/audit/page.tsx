"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import AuditTab from "@/app/components/bank/AuditTab";

/**
 * بخش «سوابق» — یک‌تیکه: فقط محتوای سوابق عملیات (جلسه ۲۷). ناوبری بین
 * بخش‌ها از منوی پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankAuditPage() {
  return (
    <AdminShell>
      <BankSection title="سوابق" subtitle="تاریخچه عملیات ثبت‌شده روی داده‌های بانک" icon="history">
        <AuditTab />
      </BankSection>
    </AdminShell>
  );
}
