"use client";

import { useId } from "react";

type HouseLogoProps = {
  /** اندازه به پیکسل — مربع */
  size?: number;
  className?: string;
};

/**
 * لوگوی فم بانک — مربع گرد مشکی با خانه قرمزِ ملایم و حرف F مشکی ظریف داخل
 * خانه (جلسه ۲۹؛ به‌خواست کاربر جایگزین طرح آبی/طلایی جلسه ۲۸ شد). حس
 * سه‌بعدی با لایه عمق سرخِ تیره در راست/پایین، هالهٔ محیطی قرمز پشت خانه،
 * بازتاب ملایم کف و هایلایت سفالین شیپ چپ بام ساخته می‌شود؛ همه بدون SVG
 * filter تا رندر در مرورگر/فاوآیکون یکسان باشد. قرمزها مات و آرامش‌بخش‌اند
 * (#D4726A→#AD4438؛ لایه عمق #7E2F27) و F با استروک نازک ۱۵ از ۵۱۲ و سرهای
 * گرد (#131318) خوانا و ظریف است. تمام SVG دست‌ساز و بدون کتابخانه خارجی؛
 * شناسه گرادیان‌ها با useId یکتا می‌شوند تا چند نمونه روی یک صفحه تداخل نکنند.
 */
export default function HouseLogo({ size = 44, className = "" }: HouseLogoProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const uid = (key: string) => `hl-${key}-${rawId}`;

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      role="img"
      style={{ filter: "drop-shadow(0 5px 9px rgba(0, 0, 0, 0.3))" }}
    >
      <defs>
        <linearGradient id={uid("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2B2B31" />
          <stop offset="1" stopColor="#0D0D11" />
        </linearGradient>
        <radialGradient id={uid("amb")} cx="0.5" cy="0.46" r="0.62">
          <stop offset="0" stopColor="#C2473C" stopOpacity="0.2" />
          <stop offset="1" stopColor="#C2473C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid("house")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D4726A" />
          <stop offset="1" stopColor="#AD4438" />
        </linearGradient>
        <clipPath id={uid("sq")}>
          <rect width="512" height="512" rx="118" />
        </clipPath>
      </defs>

      {/* مربع گرد مشکی + هاله محیطی قرمز پشت خانه */}
      <rect width="512" height="512" rx="118" fill={`url(#${uid("bg")})`} />
      <g clipPath={`url(#${uid("sq")})`}>
        <rect width="512" height="512" fill={`url(#${uid("amb")})`} />
      </g>
      {/* قاب داخلی ظریف */}
      <rect
        x="13"
        y="13"
        width="486"
        height="486"
        rx="107"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.1"
        strokeWidth="3"
      />

      {/* بازتاب قرمز ملایم کف */}
      <ellipse cx="258" cy="446" rx="168" ry="20" fill="#C2473C" opacity="0.1" />
      <ellipse cx="256" cy="442" rx="132" ry="15" fill="#C2473C" opacity="0.12" />

      {/* لایه عمق سه‌بعدی (جابه‌جایی راست/پایین) */}
      <path
        d="M128 272 L268 126 L408 272 Z"
        fill="#7E2F27"
        stroke="#7E2F27"
        strokeWidth="24"
        strokeLinejoin="round"
      />
      <rect x="150" y="260" width="236" height="176" rx="24" fill="#7E2F27" />

      {/* خانه جلو — بدنه و بام قرمز ملایم با گوشه‌های گرد */}
      <rect x="138" y="244" width="236" height="176" rx="24" fill={`url(#${uid("house")})`} />
      <path
        d="M116 256 L256 110 L396 256 Z"
        fill={`url(#${uid("house")})`}
        stroke={`url(#${uid("house")})`}
        strokeWidth="24"
        strokeLinejoin="round"
      />

      {/* هایلایت سفالین شیب چپ بام */}
      <path
        d="M152 240 L256 134"
        fill="none"
        stroke="#FFEDE9"
        strokeOpacity="0.55"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* حرف F مشکی — کوچک‌تر و ظریف */}
      <g stroke="#131318" strokeWidth="15" strokeLinecap="round" fill="none">
        <path d="M234 290 L234 368" />
        <path d="M234 290 L290 290" />
        <path d="M234 326 L278 326" />
      </g>
    </svg>
  );
}
