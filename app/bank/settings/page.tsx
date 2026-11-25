"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import BankSection from "@/app/components/bank/BankSection";
import SettingsTab from "@/app/components/bank/SettingsTab";
import { useBankData } from "@/app/components/bank/useBankData";

/**
 * بخش «تنظیمات» — یک‌تیکه: فقط محتوای تنظیمات بانک (جلسه ۲۷) — خودش
 * سر بخش‌های لیستی دارد (جلسه ۲۶ مرحله ۴). ناوبری بین بخش‌ها از منوی
 * پنل مدیریت است، مثل «مدیریت کاربران».
 */
export default function BankSettingsPage() {
  const { settings, loading, error, load } = useBankData();

  return (
    <AdminShell>
      <BankSection
        title="تنظیمات"
        subtitle="مبلغ سهم، عنوان‌های واریز، پشتیبان‌گیری و ظاهر اپ"
        icon="settings"
        loading={loading}
        error={error}
      >
        <SettingsTab settings={settings} onRefresh={load} />
      </BankSection>
    </AdminShell>
  );
}
