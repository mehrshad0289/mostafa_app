"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import LoansTab from "@/app/components/bank/LoansTab";
import { useBankData } from "@/app/components/bank/useBankData";

/**
 * بخش «وام‌ها و اقساط» — یک‌تیکه: فقط محتوای وام‌ها و اقساط (جلسه ۲۷).
 * ناوبری بین بخش‌ها از منوی پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankLoansPage() {
  const { members, loans, loading, error, load } = useBankData();

  return (
    <AdminShell>
      <BankSection
        title="وام‌ها و اقساط"
        subtitle="تسهیلات، اقساط، برداشت از بانک و تأیید درخواست‌ها"
        icon="banknote"
        loading={loading}
        error={error}
      >
        <LoansTab members={members} loans={loans} onRefresh={load} />
      </BankSection>
    </AdminShell>
  );
}
