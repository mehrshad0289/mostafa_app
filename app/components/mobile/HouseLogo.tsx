"use client";

import { useId } from "react";

type HouseLogoProps = {
  /** اندازه به پیکسل — مربع */
  size?: number;
  className?: string;
};

/**
 * لوگوی سه‌بعدی «خانه» فم بانک — آیکون برند هر دو لایه (یوزر و ادمین).
 * خانه‌ای با بام گرادیانی، بدنه آبی بانکی، لایه عمق تیره در سمت چپ/پایین
 * (حس سه‌بعدی)، دو پنجره روشن و در سفید + سایه نرم زمین — هم‌خانواده با
 * آیکون‌های سفالی (Clay) اپ. تمام SVG دست‌ساز بدون کتابخانه خارجی.
 */
export default function HouseLogo({ size = 44, className = "" }: HouseLogoProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const roofId = `hl-roof-${rawId}`;
  const bodyId = `hl-body-${rawId}`;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      role="img"
      style={{ filter: "drop-shadow(0 5px 9px rgba(26, 70, 175, 0.35))" }}
    >
      <defs>
        <linearGradient id={roofId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8CB6FF" />
          <stop offset="100%" stopColor="#2E63D6" />
        </linearGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4C86F2" />
          <stop offset="100%" stopColor="#1A46AF" />
        </linearGradient>
      </defs>

      {/* سایه نرم زمین */}
      <ellipse cx="23.5" cy="44.6" rx="14.5" ry="2.4" fill="#1A46AF" opacity="0.16" />

      {/* لایه عمق سه‌بعدی (پشت) — بام و بدنه تیره با جابه‌جایی چپ/پایین */}
      <path
        d="M9 26 L26 10.5 L43 26"
        fill="none"
        stroke="#16307C"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11.8" y="24.4" width="23" height="17" rx="3" fill="#122B6B" />

      {/* بام جلو — با خط گرد */}
      <path
        d="M9.5 23.5 L26 8.5 L42.5 23.5"
        fill="none"
        stroke={`url(#${roofId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* بدنه جلو */}
      <rect x="14" y="23.5" width="24" height="17" rx="3" fill={`url(#${bodyId})`} />

      {/* هایلایت نور روی بام (سبک سفالی) */}
      <path d="M13.5 20.5 L26 9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" />

      {/* پنجره‌های روشن */}
      <rect x="17.2" y="26.6" width="4.6" height="4.6" rx="1.5" fill="rgba(255,255,255,0.85)" />
      <rect x="30.2" y="26.6" width="4.6" height="4.6" rx="1.5" fill="rgba(255,255,255,0.85)" />

      {/* در سفید */}
      <rect x="22.6" y="30.4" width="6.8" height="10.1" rx="2.2" fill="rgba(255,255,255,0.92)" />
      <circle cx="24.1" cy="35.4" r="0.65" fill="#1A46AF" opacity="0.55" />
    </svg>
  );
}
