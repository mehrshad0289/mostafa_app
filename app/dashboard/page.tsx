"use client";

import DashboardView from "@/app/components/DashboardView";

/**
 * پنل عضو — مستقل. همان داشبورد قبلی که حالا به‌صورت کامپوننت مشترک
 * DashboardView رندر می‌شود (جلسه بیست‌وسوم) تا در پوسته موبایل /mobile
 * هم به‌عنوان تب «خانه» تعبیه شود؛ رفتار این صفحه تغییر نکرده است.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
