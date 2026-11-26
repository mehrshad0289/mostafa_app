"use client";

import ClayIcon, { type ClayIconName, toneForSeed } from "./ClayIcon";

/** جلسه ۵۲: نوار پایین ۳ آیتمی به ترتیب درخواست کاربر — خانه، تراکنش‌ها،
 *  خدمات؛ «تنظیمات» حذف شد و همهٔ آیتم‌هایش به‌صورت مربع در «خدمات» آمد */
export type MobileTab = "home" | "transactions" | "services";

const NAV: { key: MobileTab; label: string; icon: ClayIconName }[] = [
  { key: "home", label: "خانه", icon: "home" },
  { key: "transactions", label: "تراکنش‌ها", icon: "swap" },
  { key: "services", label: "خدمات", icon: "grid" },
];

type BottomNavProps = {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
};

/** نوار ناوبری پایین ثابت — جلسه ۳۶: فوتر سفید به درخواست کاربر (جلوهٔ زیباتر)
 *  با قرص فعال تینت برند، آیکون فعال رنگی و آیکون/برچسب غیرفعال خاکستری؛
 *  نوار باریک برند بالای نوار حفظ شد تا هویت برند بماند (جلسه ۳۷: آبی آسمانی).
 *  جلسه ۵۲: ترتیب جدید خانه ← تراکنش‌ها ← خدمات (بدون تنظیمات). */
export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white shadow-[0_-10px_30px_-15px_rgba(15,23,42,0.25)] dark:border-zinc-800 dark:bg-zinc-950"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ناوبری اصلی"
    >
      {/* نوار باریک برند آبی آسمانی — هماهنگ با لوگو و هدر (جلسه ۳۷) */}
      <div aria-hidden className="h-[2px] w-full bg-gradient-to-l from-sky-200 via-sky-300 to-primary-500" />
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
                isActive
                  ? "bg-primary-50 ring-1 ring-inset ring-primary-200 dark:bg-primary-950/60 dark:ring-primary-800"
                  : ""
              }`}
            >
              {isActive ? (
                <ClayIcon name={item.icon} size={40} tone={toneForSeed(item.key)} />
              ) : (
                <ClayIcon name={item.icon} size={40} ghost ghostColor="#94a3b8" />
              )}
              <span
                className={`text-[10px] leading-3 transition-colors ${
                  isActive
                    ? "font-bold text-primary-700 dark:text-primary-300"
                    : "text-zinc-500 dark:text-zinc-400"
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
