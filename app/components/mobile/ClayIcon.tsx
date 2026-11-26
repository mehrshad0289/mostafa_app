/**
 * آیکون‌های سه‌بعدی پاستلی (Claymorphism) فم بانک.
 * هر آیکون یک «لُه سفالی» گرادیانی با هایلایت نور بالای آن و سایه نرم است
 * و گلیف سفید داخلش. همه SVGهای دست‌ساز بدون کتابخانه خارجی‌اند.
 */
import type { CSSProperties } from "react";

export type ClayIconName =
  | "home"
  | "grid"
  | "swap"
  | "users"
  | "settings"
  | "coins"
  | "calendar"
  | "banknote"
  | "wallet"
  | "card"
  | "user"
  | "shield"
  | "palette"
  | "info"
  | "building"
  | "chart"
  | "download"
  | "logout"
  | "bell"
  | "plus"
  | "eye"
  | "clock"
  | "history"
  | "trash"
  | "copy"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "deposit"
  | "withdraw"
  | "receipt"
  | "phone"
  | "star"
  | "note";

export type ClayTone = [string, string];

/** جفت رنگ پاستلی هر آیکون — [روشن بالا، اشباع پایین] */
const TONES: Record<ClayIconName, ClayTone> = {
  home: ["#9CC6FF", "#4C82E0"],
  grid: ["#8FD8B6", "#3AAE75"],
  swap: ["#9ADDF2", "#3AA8CE"],
  users: ["#C3AEF5", "#8460D6"],
  settings: ["#A9BFFF", "#5B74E8"],
  coins: ["#FFD98E", "#F0A32B"],
  calendar: ["#98E5D2", "#2FB5A0"],
  banknote: ["#FFB3C6", "#E85E8A"],
  wallet: ["#B5EBA5", "#5CB85C"],
  card: ["#9ADDF2", "#3E9BD6"],
  user: ["#9CC6FF", "#4C82E0"],
  shield: ["#B0B8F8", "#6568D9"],
  palette: ["#F6A8CF", "#D65CA2"],
  info: ["#AECBE0", "#5C87A8"],
  building: ["#B9C4E8", "#6878B8"],
  chart: ["#8FE0DC", "#2FA8A2"],
  download: ["#FFC48E", "#E8842B"],
  logout: ["#FCA9A9", "#D95050"],
  bell: ["#FFE08E", "#E8A62B"],
  plus: ["#B5EBA5", "#54B854"],
  eye: ["#AECBE0", "#5C87A8"],
  clock: ["#C3AEF5", "#8460D6"],
  history: ["#98E5D2", "#2FB5A0"],
  trash: ["#FCA9A9", "#D95050"],
  copy: ["#AECBE0", "#5C87A8"],
  check: ["#B5EBA5", "#54B854"],
  "chevron-left": ["#CBD5E1", "#94A3B8"],
  "chevron-right": ["#CBD5E1", "#94A3B8"],
  deposit: ["#B5EBA5", "#54B854"],
  withdraw: ["#FFB8A8", "#E06848"],
  receipt: ["#FFD98E", "#F0A32B"],
  phone: ["#9ADDF2", "#3E9BD6"],
  star: ["#FFE08E", "#E8A62B"],
  note: ["#F6A8CF", "#D65CA2"],
};

const G = (d: string) => <path d={d} />;

/** گلیف سفید داخل هر آیکون — شبکه ۲۴×۲۴ با خط گرد */
const GLYPHS: Record<ClayIconName, React.ReactNode> = {
  home: (
    <>
      {G("M3.5 11.5 12 4l8.5 7.5")}
      {G("M5.8 10.2V19a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1v-8.8")}
      {G("M9.8 20v-4.6a1.2 1.2 0 0 1 1.2-1.2h2a1.2 1.2 0 0 1 1.2 1.2V20")}
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.8" height="6.8" rx="2.2" />
      <rect x="13.2" y="4" width="6.8" height="6.8" rx="2.2" />
      <rect x="4" y="13.2" width="6.8" height="6.8" rx="2.2" />
      <rect x="13.2" y="13.2" width="6.8" height="6.8" rx="2.2" />
    </>
  ),
  swap: (
    <>
      {G("M4.5 8h14l-3.8-3.8")}
      {G("M19.5 16h-14l3.8 3.8")}
    </>
  ),
  users: (
    <>
      <circle cx="9.2" cy="8.4" r="3.3" />
      {G("M3.4 19.4c.7-3.3 3-5 5.8-5s5.1 1.7 5.8 5")}
      {G("M15.9 5.7a3.1 3.1 0 0 1 .4 5.5")}
      {G("M16.6 14.6c2.3.5 3.7 2 4.2 4.4")}
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      {G("M12 3.6v2.6M12 17.8v2.6M20.4 12h-2.6M6.2 12H3.6M17.9 6.1l-1.8 1.8M7.9 16.1l-1.8 1.8M17.9 17.9l-1.8-1.8M7.9 7.9 6.1 6.1")}
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.6" rx="6.6" ry="2.7" />
      {G("M5.4 6.6v5.2c0 1.5 2.9 2.7 6.6 2.7s6.6-1.2 6.6-2.7V6.6")}
      {G("M5.4 11.8V17c0 1.5 2.9 2.7 6.6 2.7s6.6-1.2 6.6-2.7v-5.2")}
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.4" width="16" height="14.6" rx="3" />
      {G("M8.2 3.4v3.4M15.8 3.4v3.4M4 10h16")}
      {G("M9.4 14.8l1.9 1.9 3.3-3.3")}
    </>
  ),
  banknote: (
    <>
      <rect x="3.4" y="7" width="17.2" height="10.4" rx="2.6" />
      <circle cx="12" cy="12.2" r="2.5" />
      {G("M6.6 10.4v3.6M17.4 10.4v3.6")}
    </>
  ),
  wallet: (
    <>
      <rect x="3.4" y="6.2" width="17.2" height="13" rx="3" />
      {G("M3.4 9.8h17.2")}
      {G("M15.2 14.6h5.4v2.6h-5.4a1.3 1.3 0 0 1 0-2.6z")}
    </>
  ),
  card: (
    <>
      <rect x="3.4" y="5.4" width="17.2" height="13.6" rx="3" />
      {G("M3.4 10h17.2")}
      {G("M7 15.2h4.4")}
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      {G("M5 20c1-3.7 3.8-5.4 7-5.4s6 1.7 7 5.4")}
    </>
  ),
  shield: (
    <>
      {G("M12 3.4 19 6v5.8c0 4.6-2.9 7.5-7 8.8-4.1-1.3-7-4.2-7-8.8V6z")}
      {G("M9.4 11.7l1.9 1.9 3.4-3.4")}
    </>
  ),
  palette: (
    <>
      {G("M12 3.6c-4.7 0-8.4 3.2-8.4 7.5 0 4.3 3.2 7.2 6.8 7.2 1.4 0 2-.8 2-1.7 0-.8-.6-1.3-.6-2 0-.9.8-1.6 1.9-1.6h2.1c2.5 0 4.6-1.8 4.6-4.2 0-3.1-3.7-5.2-8.4-5.2z")}
      <circle cx="8.1" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.9" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      {G("M12 11.2v5")}
      <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3.8" width="14" height="16.4" rx="2.4" />
      {G("M9 7.6h2M13 7.6h2M9 11h2M13 11h2M9.6 20.2v-3.2h4.8v3.2")}
    </>
  ),
  chart: (
    <>
      {G("M4.5 19.8h15")}
      {G("M7.5 19.8v-6.5M12 19.8V7.5M16.5 19.8V11")}
    </>
  ),
  download: (
    <>
      {G("M12 4v10.4")}
      {G("M8.2 11l3.8 3.8L15.8 11")}
      {G("M5 19.6h14")}
    </>
  ),
  logout: (
    <>
      {G("M14.6 4.4h3.6a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4h-3.6")}
      {G("M13 12H3.8")}
      {G("M7.2 8.4 3.6 12l3.6 3.6")}
    </>
  ),
  bell: (
    <>
      {G("M6.2 10a5.8 5.8 0 0 1 11.6 0c0 3.8 1.4 5.2 1.9 5.8H4.3c.5-.6 1.9-2 1.9-5.8z")}
      {G("M9.9 18.8a2.2 2.2 0 0 0 4.2 0")}
    </>
  ),
  plus: (
    <>
      {G("M12 5v14")}
      {G("M5 12h14")}
    </>
  ),
  eye: (
    <>
      {G("M2.6 12S6.2 6 12 6s9.4 6 9.4 6-3.6 6-9.4 6-9.4-6-9.4-6z")}
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      {G("M12 7.4V12l3 2")}
    </>
  ),
  history: (
    <>
      {G("M4.2 12a7.8 7.8 0 1 0 2.3-5.5")}
      {G("M6.2 3.6v3.2h3.2")}
      {G("M12 8V12l2.8 1.9")}
    </>
  ),
  trash: (
    <>
      {G("M4.5 7h15")}
      {G("M9.4 7V4.8a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V7")}
      {G("M6.6 7l.9 12.2a1.4 1.4 0 0 0 1.4 1.3h6.2a1.4 1.4 0 0 0 1.4-1.3L17.4 7")}
      {G("M10 10.6v6M14 10.6v6")}
    </>
  ),
  copy: (
    <>
      <rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.6" />
      {G("M5.6 15.4h-.2A1.8 1.8 0 0 1 3.6 13.6V5.4a1.8 1.8 0 0 1 1.8-1.8h8.2a1.8 1.8 0 0 1 1.8 1.8v.2")}
    </>
  ),
  check: G("M5 12.6l4.4 4.4L19 7.4"),
  "chevron-left": G("M14.4 6.2 8.6 12l5.8 5.8"),
  "chevron-right": G("M9.6 6.2l5.8 5.8-5.8 5.8"),
  deposit: (
    <>
      {G("M4 13.6V17a2.6 2.6 0 0 0 2.6 2.6h10.8A2.6 2.6 0 0 0 20 17v-3.4")}
      {G("M12 4v9.2")}
      {G("M8.4 9.6 12 13.2l3.6-3.6")}
    </>
  ),
  withdraw: (
    <>
      {G("M4 13.6V17a2.6 2.6 0 0 0 2.6 2.6h10.8A2.6 2.6 0 0 0 20 17v-3.4")}
      {G("M12 13.2V4")}
      {G("M8.4 7.6 12 4l3.6 3.6")}
    </>
  ),
  receipt: (
    <>
      {G("M6.4 3.6h11.2v16.8l-2.24-1.6-2.24 1.6-2.24-1.6-2.24 1.6L6.4 20.4z")}
      {G("M9.4 8h5.2M9.4 11.6h5.2")}
    </>
  ),
  phone: (
    <>
      <rect x="6.4" y="3.4" width="11.2" height="17.2" rx="2.6" />
      {G("M10.6 17.4h2.8")}
    </>
  ),
  star: G("M12 4.2l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.4l5-.6z"),
  note: (
    <>
      <rect x="4.4" y="3.8" width="15.2" height="16.4" rx="3" />
      {G("M8.4 8.4h7.2M8.4 12h7.2M8.4 15.6h4.2")}
    </>
  ),
};

const DEFAULT_TONE: ClayTone = ["#9CC6FF", "#4C82E0"];

type ClayIconProps = {
  name: ClayIconName;
  /** اندازه به پیکسل — گلیف خودکار ~۵۲٪ همین است */
  size?: number;
  /** جایگزین جفت رنگ پیش‌فرض */
  tone?: ClayTone;
  /** بدون لُه سفالی — فقط گلیف (برای حالت غیرفعال نوار پایین) */
  ghost?: boolean;
  /** رنگ گلیف در حالت ghost */
  ghostColor?: string;
  className?: string;
  style?: CSSProperties;
};

export default function ClayIcon({
  name,
  size = 56,
  tone,
  ghost = false,
  ghostColor = "currentColor",
  className = "",
  style,
}: ClayIconProps) {
  const [c1, c2] = tone ?? TONES[name] ?? DEFAULT_TONE;
  const glyph = (
    <svg
      viewBox="0 0 24 24"
      width={Math.round(size * 0.52)}
      height={Math.round(size * 0.52)}
      fill="none"
      stroke={ghost ? ghostColor : "#fff"}
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name] ?? GLYPHS.info}
    </svg>
  );

  if (ghost) {
    return (
      <span className={`inline-grid place-items-center ${className}`} style={{ width: size, height: size, ...style }}>
        {glyph}
      </span>
    );
  }

  return (
    <span
      className={`clay ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${c1} 0%, ${c2} 100%)`, ...style }}
    >
      {glyph}
    </span>
  );
}

/** انتخاب رنگ آواتار بر اساس حرف/شناسه — برای چرخش پالت روی لیست‌ها */
const AVATAR_TONES: ClayTone[] = [
  ["#9CC6FF", "#4C82E0"],
  ["#C3AEF5", "#8460D6"],
  ["#FFB3C6", "#E85E8A"],
  ["#98E5D2", "#2FB5A0"],
  ["#FFD98E", "#F0A32B"],
  ["#B5EBA5", "#54B854"],
  ["#F6A8CF", "#D65CA2"],
  ["#9ADDF2", "#3E9BD6"],
];

export function toneForSeed(seed: string): ClayTone {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** رنگ پایه هر آیکون — برای تینت پاستلی کارت‌ها هماهنگ با آیکون داخلشان (جلسه ۳۲) */
export function toneForIcon(name: ClayIconName): ClayTone {
  return TONES[name];
}
