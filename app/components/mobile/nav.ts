import type { DashboardTab } from "@/app/components/DashboardView";

/** بخش‌های جزئیاتی که از گرید «خدمات» باز می‌شوند — قبل از جلسه ۵۲ ردیف‌های
 *  صفحه «تنظیمات» بودند؛ حالا هر کدام یک مربع در خدمات است
 *  (جلسه ۴۱: بخش «راهنما»؛ جلسه ۴۸: «پشتیبان‌گیری»؛ جلسه ۵۰: «پیام‌ها»؛
 *  جلسه ۵۲: «حساب‌های واریز» به «اطلاعات واریز» تغییر نام داد) */
export type SettingsSection =
  | "profile"
  | "security"
  | "backup"
  | "appearance"
  | "deposits"
  | "messages"
  | "fund"
  | "guide"
  | "about";

/** مقصد ناوبری داخل پوسته موبایل — همه صفحه‌ها با همین قرارداد به هم می‌روند
 *  (تب «مدیریت کاربران» از جلسه ۲۷ حذف شد؛ مدیریت کاربران فقط در پنل ادمین است)
 *  جلسه ۳۶: dashboardTab از DashboardView است (شامل "loans-installments")
 *  جلسه ۵۲: تب «تنظیمات» حذف شد؛ پرش به بخش‌های جزئیاتی حالا با
 *  { tab: "services", section } است — نوار پایین ۳ آیتمی است:
 *  خانه، تراکنش‌ها، خدمات.
 *  جلسه ۵۳: openPayment (فقط با dashboardTab) = پرش مستققیم از اکشن‌های
 *  سریع تراکنش‌ها به فرم اولین پرداخت در دسترس ("share" = پرداخت سهام،
 *  "installment" = اولین قسط پرداخت‌نشده). */
export type NavTarget =
  | { tab: "home"; dashboardTab?: DashboardTab; openPayment?: "share" | "installment" }
  | { tab: "services"; section?: SettingsSection }
  | { tab: "transactions" };
