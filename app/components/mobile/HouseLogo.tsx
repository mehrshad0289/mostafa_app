"use client";

import { useId } from "react";

type HouseLogoProps = {
  /** اندازه به پیکسل — مربع */
  size?: number;
  className?: string;
};

/**
 * لوگوی فَم بانک — مربع گرد با پس‌زمینه سرمه‌ای تیره و عمیق، خانه استایل‌دار
 * با بدنه گرادیانت درخشان فیروزه‌ای نئون → آبی الکتریک، سقف سفید براق با
 * هایلایت، سایه نرم واقعی زیر خانه + بازتاب نئون کف، و حرف F بزرگ سرمه‌ای در
 * مرکز (جلسه ۳۰؛ به‌خواست کاربر جایگزین طرح مشکی/قرمز جلسه ۲۹ شد). حس
 * سه‌بعدی و نورپردازی استودیویی با هاله نئون پشت خانه، نور مایل بالا-چپ،
 * وینیت پایین، لایه عمق تیره در راست/پایین و لبه شیشه‌ای بدنه ساخته می‌شود؛
 * همه بدون SVG filter تا رندر در مرورگر/فاوآیکون یکسان باشد. حرف F سرمه‌ای
 * (#17345E→#0A1B36) با استروک ۲۲ از ۵۱۲ و سرهای گرد، بزرگ و خوانا است و روی
 * بدنه روشن بهترین کنتراست را دارد (گزینه سفید در مقایسه رندر پس زده شد).
 * تمام SVG دست‌ساز و بدون کتابخانه خارجی؛ شناسه گرادیان‌ها با useId یکتا
 * می‌شوند تا چند نمونه روی یک صفحه تداخل نکنند.
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
      style={{ filter: "drop-shadow(0 6px 12px rgba(2, 8, 23, 0.45))" }}
    >
      <defs>
        <linearGradient id={uid("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#212F5A" />
          <stop offset="0.5" stopColor="#0F1B3D" />
          <stop offset="1" stopColor="#060C1F" />
        </linearGradient>
        <radialGradient id={uid("glow")} cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#26E5D3" stopOpacity="0.26" />
          <stop offset="0.55" stopColor="#1E82D8" stopOpacity="0.1" />
          <stop offset="1" stopColor="#1E82D8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={uid("top")} cx="0.24" cy="0.1" r="0.55">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid("vig")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#04081A" stopOpacity="0" />
          <stop offset="1" stopColor="#04081A" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient
          id={uid("body")}
          x1="150"
          y1="250"
          x2="380"
          y2="430"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#45F5DC" />
          <stop offset="0.5" stopColor="#1FC9E4" />
          <stop offset="1" stopColor="#2B66F0" />
        </linearGradient>
        <linearGradient
          id={uid("roof")}
          x1="256"
          y1="98"
          x2="256"
          y2="268"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C9E2F8" />
        </linearGradient>
        <linearGradient
          id={uid("shine")}
          x1="152"
          y1="240"
          x2="256"
          y2="134"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient
          id={uid("f")}
          x1="226"
          y1="282"
          x2="226"
          y2="398"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#17345E" />
          <stop offset="1" stopColor="#0A1B36" />
        </linearGradient>
        <clipPath id={uid("sq")}>
          <rect width="512" height="512" rx="118" />
        </clipPath>
        <clipPath id={uid("bodyclip")}>
          <rect x="138" y="244" width="236" height="176" rx="24" />
        </clipPath>
      </defs>

      {/* مربع گرد سرمه‌ای عمیق + نورپردازی استودیویی (هاله نئون، نور بالا-چپ، وینیت) */}
      <rect width="512" height="512" rx="118" fill={`url(#${uid("bg")})`} />
      <g clipPath={`url(#${uid("sq")})`}>
        <rect width="512" height="512" fill={`url(#${uid("glow")})`} />
        <rect width="512" height="512" fill={`url(#${uid("top")})`} />
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
        stroke="#BFDFFF"
        strokeOpacity="0.14"
        strokeWidth="3"
      />

      {/* بازتاب نئون کف + سایه نرم واقعی زیر خانه */}
      <ellipse cx="262" cy="436" rx="178" ry="26" fill="#2BE4D6" opacity="0.13" />
      <ellipse cx="260" cy="432" rx="140" ry="19" fill="#2BE4D6" opacity="0.16" />
      <ellipse cx="264" cy="438" rx="152" ry="18" fill="#01050F" opacity="0.45" />
      <ellipse cx="262" cy="434" rx="122" ry="14" fill="#01050F" opacity="0.5" />
      <ellipse cx="260" cy="430" rx="94" ry="11" fill="#01050F" opacity="0.55" />

      {/* لایه عمق سه‌بعدی (جابه‌جایی راست/پایین) */}
      <path
        d="M128 272 L268 126 L408 272 Z"
        fill="#0D5878"
        stroke="#0D5878"
        strokeWidth="24"
        strokeLinejoin="round"
      />
      <rect x="150" y="260" width="236" height="176" rx="24" fill="#0D5878" />

      {/* خانه جلو — بدنه گرادیانت درخشان با لبه شیشه‌ای و بازتاب شیشه */}
      <rect
        x="138"
        y="244"
        width="236"
        height="176"
        rx="24"
        fill={`url(#${uid("body")})`}
        stroke="#DFF9FF"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <g clipPath={`url(#${uid("bodyclip")})`}>
        <path d="M196 244 L252 244 L156 420 L100 420 Z" fill="#ffffff" opacity="0.1" />
        <path d="M292 244 L318 244 L222 420 L196 420 Z" fill="#ffffff" opacity="0.07" />
      </g>

      {/* سقف سفید براق + هایلایت شیپ چپ */}
      <path
        d="M116 256 L256 110 L396 256 Z"
        fill={`url(#${uid("roof")})`}
        stroke={`url(#${uid("roof")})`}
        strokeWidth="24"
        strokeLinejoin="round"
      />
      <path
        d="M152 240 L256 134"
        fill="none"
        stroke={`url(#${uid("shine")})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* حرف F بزرگ سرمه‌ای در مرکز خانه */}
      <g
        stroke={`url(#${uid("f")})`}
        strokeWidth="22"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M226 282 L226 398" />
        <path d="M226 282 L308 282" />
        <path d="M226 334 L290 334" />
      </g>
    </svg>
  );
}
