import type { DashboardTab } from "@/app/components/DashboardView";

/** بخش‌های صفحه تنظیمات پوسته موبایل — جلسه ۴۱: بخش «راهنما» افزوده شد */
export type SettingsSection =
  | "profile"
  | "security"
  | "appearance"
  | "deposits"
  | "fund"
  | "guide"
  | "about";

/** مقصد ناوبری داخل پوسته موبایل — همه صفحه‌ها با همین قرارداد به هم می‌روند
 *  (تب «مدیریت کاربران» از جلسه ۲۷ حذف شد؛ مدیریت کاربران فقط در پنل ادمین است)
 *  جلسه ۳۶: dashboardTab از DashboardView است (شامل "loans-installments") */
export type NavTarget =
  | { tab: "home"; dashboardTab?: DashboardTab }
  | { tab: "services" }
  | { tab: "transactions" }
  | { tab: "settings"; section?: SettingsSection };
