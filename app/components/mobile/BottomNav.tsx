"use client";

import ClayIcon, { type ClayIconName } from "./ClayIcon";

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
/** جلسه ۶۰ — نوار پایین طبق طراحی PDF کاربر: آیتم فعال = مربع گرد گرادیان آبی
 *  با گلیف سفید + برچسب آبی پررنگ؛ غیرفعال = آیکون/برچسب خاکستری.
 *  جلسه ۵۲: ترتیب خانه ← تراکنش‌ها ← خدمات حفظ شده (بدون تغییر ساختار). */
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
                isActive ? "" : "opacity-90"
              }`}
            >
              {isActive ? (
                <>
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tl from-primary-700 to-primary-500 shadow-md shadow-primary-600/40"
                  >
                    <ClayIcon name={item.icon} size={22} ghost ghostColor="#fff" />
                  </span>
                  <span className="text-[10px] font-bold leading-3 text-primary-700 dark:text-primary-300">
                    {item.label}
                  </span>
                </>
              ) : (
                <>
                  <span className="grid size-10 place-items-center">
                    <ClayIcon name={item.icon} size={36} ghost ghostColor="#94a3b8" />
                  </span>
                  <span className="text-[10px] leading-3 text-zinc-500 dark:text-zinc-400">{item.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
