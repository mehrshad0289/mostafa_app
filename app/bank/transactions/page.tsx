"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import DepositsTab from "@/app/components/bank/DepositsTab";
import { useBankData } from "@/app/components/bank/useBankData";

/**
 * بخش «تراکنش‌ها» — یک‌تیکه: فقط محتوای تراکنش‌ها (جلسه ۲۷) — واریزها،
 * پرداخت اقساط تسهیلات و برداشت‌های بانک. ناوبری بین بخش‌ها از منوی پنل
 * مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankTransactionsPage() {
  const { members, deposits, loans, settings, loading, error, load } = useBankData();

  return (
    <AdminShell>
      <BankSection
        title="تراکنش‌ها"
        subtitle="همه واریزی‌ها، اقساط پرداختی و برداشت‌های بانک"
        icon="swap"
        loading={loading}
        error={error}
      >
        <DepositsTab members={members} deposits={deposits} loans={loans} settings={settings} onRefresh={load} />
      </BankSection>
    </AdminShell>
  );
}
