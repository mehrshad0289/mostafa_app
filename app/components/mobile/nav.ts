import type { TabKey } from "@/app/components/DashboardView";

/** بخش‌های صفحه تنظیمات پوسته موبایل */
export type SettingsSection =
  | "profile"
  | "security"
  | "appearance"
  | "deposits"
  | "fund"
  | "about";

/** مقصد ناوبری داخل پوسته موبایل — همه صفحه‌ها با همین قرارداد به هم می‌روند
 *  (تب «مدیریت کاربران» از جلسه ۲۷ حذف شد؛ مدیریت کاربران فقط در پنل ادمین است) */
export type NavTarget =
  | { tab: "home"; dashboardTab?: TabKey }
  | { tab: "services" }
  | { tab: "transactions" }
  | { tab: "settings"; section?: SettingsSection };
