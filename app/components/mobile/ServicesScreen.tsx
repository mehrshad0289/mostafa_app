"use client";

import { useRouter } from "next/navigation";
import ClayIcon, { type ClayIconName } from "./ClayIcon";
import type { NavTarget, SettingsSection } from "./nav";
import type { PublicUser } from "@/lib/db";

type ServiceTile = {
  label: string;
  icon: ClayIconName;
  target: NavTarget | { href: string };
};

type ServiceGroup = {
  title: string;
  tiles: ServiceTile[];
};

/** گروه‌های خدمات — برای عضو و مدیر (گروه مدیریت فقط برای ادمین) */
function groupsFor(isAdmin: boolean): ServiceGroup[] {
  const bank: ServiceGroup = {
    title: "خدمات صندوق",
    tiles: [
      { label: "پرداخت سهام", icon: "coins", target: { tab: "home", dashboardTab: "shares" } },
      { label: "پرداخت قسط", icon: "calendar", target: { tab: "home", dashboardTab: "installments" } },
      { label: "درخواست تسهیلات", icon: "banknote", target: { tab: "home", dashboardTab: "loans" } },
      { label: "حساب‌های واریز", icon: "wallet", target: { tab: "home", dashboardTab: "deposit" } },
    ],
  };
  const app: ServiceGroup = {
    title: "حساب و اپلیکیشن",
    tiles: [
      { label: "پروفایل من", icon: "user", target: { tab: "settings", section: "profile" } },
      { label: "امنیت و رمز", icon: "shield", target: { tab: "settings", section: "security" } },
      { label: "ظاهر و تم", icon: "palette", target: { tab: "settings", section: "appearance" } },
      { label: "درباره اپ", icon: "info", target: { tab: "settings", section: "about" } },
    ],
  };
  const admin: ServiceGroup = {
    title: "مدیریت صندوق",
    tiles: [
      { label: "مدیریت کاربران", icon: "users", target: { tab: "users" } },
      { label: "تراکنش‌ها", icon: "swap", target: { tab: "transactions" } },
      { label: "پنل مدیریت", icon: "building", target: { href: "/admin" } },
      { label: "تنظیمات صندوق", icon: "settings", target: { tab: "settings", section: "fund" satisfies SettingsSection } },
    ],
  };
  return isAdmin ? [bank, admin, app] : [bank, app];
}

type ServicesScreenProps = {
  me: PublicUser;
  onNavigate: (target: NavTarget) => void;
};

/** اسلاید خدمات — گرید چندستونه آیکون‌های سه‌بعدی با برچسب فارسی زیر هر آیکون */
export default function ServicesScreen({ me, onNavigate }: ServicesScreenProps) {
  const router = useRouter();
  const groups = groupsFor(me.role === "admin");

  function openTile(tile: ServiceTile) {
    if ("href" in tile.target) {
      router.push(tile.target.href);
    } else {
      onNavigate(tile.target);
    }
  }

  return (
    <div className="space-y-5 px-4 pt-4">
      {groups.map((group) => (
        <section key={group.title} className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <span className="clay" style={{ width: 18, height: 18, background: "linear-gradient(140deg, #9CC6FF, #4C82E0)" }} />
            {group.title}
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {group.tiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => openTile(tile)}
                className="clay-press flex flex-col items-center gap-2 rounded-3xl border border-zinc-200/80 bg-white px-1.5 py-3.5 shadow-sm hover:border-primary-300 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <ClayIcon name={tile.icon} size={46} />
                <span className="text-center text-[10.5px] font-medium leading-4 text-zinc-700 dark:text-zinc-300">
                  {tile.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="pb-2 text-center text-[11px] leading-6 text-zinc-400">
        برای هر خدمت فقط کافی است آیکونش را بزنید؛ مستقیم به همان بخش می‌روید.
      </p>
    </div>
  );
}
