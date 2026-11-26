"use client";

import ClayIcon, { type ClayIconName, toneForSeed } from "./ClayIcon";

export type MobileTab = "home" | "services" | "transactions" | "settings";

const NAV: { key: MobileTab; label: string; icon: ClayIconName }[] = [
  { key: "home", label: "خانه", icon: "home" },
  { key: "services", label: "خدمات", icon: "grid" },
  { key: "transactions", label: "تراکنش‌ها", icon: "swap" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
];

type BottomNavProps = {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
};

/** نوار ناوبری پایین ثابت — فوتر رنگی آبی برند با هایلایت آیتم فعال (جلسه ۳۲؛ جلسه ۳۳ یک درجه، جلسه ۳۴ دو درجه روشن‌تر به درخواست «فوترها تیره است») */
export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-primary-700 via-primary-600 to-primary-600 shadow-[0_-10px_30px_-12px_rgba(29,78,216,0.35)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ناوبری اصلی"
    >
      {/* نوار باریک فیروزه‌ای هماهنگ با لوگو و هدر */}
      <div aria-hidden className="h-[2px] w-full bg-gradient-to-l from-teal-300 via-cyan-400 to-primary-400" />
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 py-1.5">
        {NAV.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={`clay-press flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1 transition-colors ${
                isActive ? "bg-white/20 ring-1 ring-inset ring-white/30" : ""
              }`}
            >
              {isActive ? (
                <ClayIcon name={item.icon} size={40} tone={toneForSeed(item.key)} />
              ) : (
                <ClayIcon name={item.icon} size={40} ghost ghostColor="#c3d2ef" />
              )}
              <span
                className={`text-[10px] leading-3 transition-colors ${
                  isActive ? "font-bold text-white" : "text-white/65"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
