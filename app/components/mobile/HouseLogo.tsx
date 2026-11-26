"use client";

type HouseLogoProps = {
  /** اندازه به پیکسل — مربع */
  size?: number;
  className?: string;
};

/**
 * لوگوی فَم بانک — جلسه ۴۹ به درخواست کاربر: «لوگو در هر دو لایه به شکل لوگوی
 * ارسالی شود». تصویر ارسالی کاربر (حرف «ف» سفید با نقطهٔ لوزی روی زمینهٔ
 * گرادیان سرمه‌ای با موج‌های آبی و ساختمان بانک در بالا-چپ) در public/logo.png
 * ذخیره شده و این کامپوننت همان تصویر را با گوشهٔ گرد و سایهٔ نرم رندر می‌کند.
 * همهٔ مکان‌های قبلی (هدر پنل ادمین، هدر پوسته موبایل، لودینگ‌ها، کارت دربارهٔ
 * تنظیمات) از همین کامپوننت تغذیه می‌شوند؛ فاوآیکون‌ها هم از همان تصویر ساخته
 * شده‌اند (app/icon.png، app/favicon.ico، app/apple-icon.png).
 */
export default function HouseLogo({ size = 44, className = "" }: HouseLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="لوگوی فَم بانک"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "22%",
        objectFit: "cover",
        filter: "drop-shadow(0 4px 10px rgba(2, 8, 23, 0.35))",
      }}
      draggable={false}
    />
  );
}
