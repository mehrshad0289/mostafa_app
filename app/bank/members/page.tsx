"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import MembersTab from "@/app/components/bank/MembersTab";
import { useBankData } from "@/app/components/bank/useBankData";

/**
 * بخش «اعضا» — یک‌تیکه: فقط محتوای اعضا (جلسه ۲۷). ناوبری بین بخش‌ها از
 * منوی پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankMembersPage() {
  const { members, deposits, loans, settings, loading, error, load } = useBankData();

  return (
    <AdminShell>
      <BankSection
        title="اعضا"
        subtitle="ثبت عضو مالی، حساب‌های ورود و کارت عضویت"
        icon="user"
        loading={loading}
        error={error}
      >
        <MembersTab
          members={members}
          deposits={deposits}
          loans={loans}
          amountPerShare={settings?.amountPerShare ?? 0}
          onRefresh={load}
        />
      </BankSection>
    </AdminShell>
  );
}
