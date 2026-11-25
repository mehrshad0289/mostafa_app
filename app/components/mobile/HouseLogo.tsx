"use client";

import { useId } from "react";

type HouseLogoProps = {
  /** اندازه به پیکسل — مربع */
  size?: number;
  className?: string;
};

/**
 * لوگوی فم بانک — مربع گرد آبی گرادیانی با خانه سفید ساده و حرف F ظریف
 * طلایی داخل خانه (جلسه ۲۸؛ جایگزین لوگوی خانه سفالی قبلی). حس سه‌بعدی با
 * لایه عمق تیره در راست/پایین، سایه نرم زمین (بیضی‌های تودرتو بدون filter
 * تا در همه رندرها یکسان باشد) و تیرگی ملایم کف مربع ساخته می‌شود. خط بام
 * و حرف F طلایی هم‌خانواده‌اند و مفهوم «بانک خانوادگی» را می‌رسانند؛ رنگ‌های
 * پایه از پالت primary آبی اپ (#2E63D6/#1A46AF) هستند. تمام SVG دست‌ساز و
 * بدون کتابخانه خارجی؛ شناسه گرادیان‌ها با useId یکتا می‌شوند تا چند نمونه
 * روی یک صفحه تداخل نکنند.
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
      style={{ filter: "drop-shadow(0 5px 9px rgba(26, 70, 175, 0.35))" }}
    >
      <defs>
        <linearGradient id={uid("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5E96F6" />
          <stop offset="0.45" stopColor="#2E63D6" />
          <stop offset="1" stopColor="#142B66" />
        </linearGradient>
        <radialGradient id={uid("glow")} cx="0.32" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid("vig")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#071636" stopOpacity="0" />
          <stop offset="1" stopColor="#071636" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={uid("roof")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#DCE8FF" />
        </linearGradient>
        <linearGradient id={uid("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#D7E5FF" />
        </linearGradient>
        <linearGradient
          id={uid("ridge")}
          x1="256"
          y1="142"
          x2="256"
          y2="246"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset="1" stopColor="#EFAF3F" />
        </linearGradient>
        <linearGradient
          id={uid("f")}
          x1="256"
          y1="278"
          x2="256"
          y2="372"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFDF94" />
          <stop offset="1" stopColor="#E0981F" />
        </linearGradient>
        <clipPath id={uid("sq")}>
          <rect width="512" height="512" rx="118" />
        </clipPath>
      </defs>

      {/* مربع گرد پس‌زمینه + درخشش بالا و تیرگی ملایم کف */}
      <rect width="512" height="512" rx="118" fill={`url(#${uid("bg")})`} />
      <g clipPath={`url(#${uid("sq")})`}>
        <rect width="512" height="512" fill={`url(#${uid("glow")})`} />
        <rect width="512" height="512" fill={`url(#${uid("vig")})`} />
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
        strokeOpacity="0.16"
        strokeWidth="3"
      />

      {/* سایه نرم زمین (بیضی‌های تودرتو) */}
      <ellipse cx="264" cy="428" rx="172" ry="22" fill="#04153A" opacity="0.1" />
      <ellipse cx="262" cy="424" rx="150" ry="18" fill="#04153A" opacity="0.12" />
      <ellipse cx="260" cy="420" rx="125" ry="14" fill="#04153A" opacity="0.14" />

      {/* لایه عمق سه‌بعدی (جابه‌جایی راست/پایین) */}
      <g opacity="0.92">
        <path
          d="M144 274 L268 148 L392 274 Z"
          fill="#0A2150"
          stroke="#0A2150"
          strokeWidth="22"
          strokeLinejoin="round"
        />
        <rect x="160" y="262" width="216" height="158" rx="22" fill="#0A2150" />
      </g>

      {/* خانه جلو — بدنه و بام گرادیانی با گوشه‌های گرد */}
      <rect x="148" y="246" width="216" height="158" rx="22" fill={`url(#${uid("body")})`} />
      <path
        d="M132 258 L256 126 L380 258 Z"
        fill={`url(#${uid("roof")})`}
        stroke={`url(#${uid("roof")})`}
        strokeWidth="22"
        strokeLinejoin="round"
      />

      {/* خط بام طلایی */}
      <path
        d="M152 246 L256 142 L360 246"
        fill="none"
        stroke={`url(#${uid("ridge")})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* حرف F ظریف داخل خانه */}
      <g stroke={`url(#${uid("f")})`} strokeWidth="18" strokeLinecap="round" fill="none">
        <path d="M230 278 L230 372" />
        <path d="M230 278 L302 278" />
        <path d="M230 320 L288 320" />
      </g>
    </svg>
  );
}
