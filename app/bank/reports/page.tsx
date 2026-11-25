"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import ReportsTab from "@/app/components/bank/ReportsTab";
import { useBankData } from "@/app/components/bank/useBankData";

/**
 * بخش «گزارش‌ها» — یک‌تیکه: فقط محتوای گزارش‌ها (جلسه ۲۷). ناوبری بین
 * بخش‌ها از منوی پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankReportsPage() {
  const { members, deposits, loans, settings, loading, error } = useBankData();

  return (
    <AdminShell>
      <BankSection
        title="گزارش‌ها"
        subtitle="گزارش کل، آمار وام‌ها، سود وام و چاپ"
        icon="chart"
        loading={loading}
        error={error}
      >
        <ReportsTab
          members={members}
          deposits={deposits}
          loans={loans}
          amountPerShare={settings?.amountPerShare ?? 0}
        />
      </BankSection>
    </AdminShell>
  );
}
