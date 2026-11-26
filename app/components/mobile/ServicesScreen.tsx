"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClayIcon, { toneForIcon, type ClayIconName } from "./ClayIcon";
import ServiceDetailScreen from "./ServiceDetailScreen";
import type { SettingsSection } from "./nav";
import type { PublicUser } from "@/lib/db";

/**
 * اسلاید «خدمات» — جلسه ۵۲ به درخواست کاربر:
 * ۱) صفحهٔ «تنظیمات» حذف شد و همهٔ آیتم‌هایش به‌صورت مربع در همین گرید آمد؛
 * ۲) بدون دوتیکه‌سازی و بدون عنوان گروه — همهٔ مربع‌ها در یک گرید تخت؛
 * ۳) «حساب‌های واریز» به «اطلاعات واریز» تغییر نام داد؛
 * ۴) «پرداخت سهام» و «تسهیلات» حذف شدند (در صفحهٔ خانه موجودند).
 * لمس هر مربع جزئیات همان بخش را باز می‌کند (ServiceDetailScreen) و
 * مربع «خروج از حساب» مودال تأیید خروج را باز می‌کند.
 */

type ServiceTile = {
  label: string;
  icon: ClayIconName;
  target: { section: SettingsSection } | { href: string } | { logout: true };
  adminOnly?: boolean;
  memberOnly?: boolean;
  /** تُن آیکون سفارشی (مثل خروج از حساب) */
  tone?: [string, string];
};

function tilesFor(isAdmin: boolean): ServiceTile[] {
  const tiles: ServiceTile[] = [
    { label: "اطلاعات واریز", icon: "wallet", target: { section: "deposits" } },
    { label: "پروفایل من", icon: "user", target: { section: "profile" } },
    { label: "امنیت و رمز", icon: "shield", target: { section: "security" } },
    { label: "پیام‌ها", icon: "note", target: { section: "messages" }, memberOnly: true },
    { label: "پشتیبان‌گیری", icon: "download", target: { section: "backup" } },
    { label: "ظاهر و تم", icon: "palette", target: { section: "appearance" } },
    { label: "راهنما", icon: "info", target: { section: "guide" } },
    { label: "درباره اپ", icon: "info", target: { section: "about" } },
    { label: "تنظیمات بانک", icon: "settings", target: { section: "fund" }, adminOnly: true },
    { label: "پنل مدیریت", icon: "building", target: { href: "/admin" }, adminOnly: true },
  ];
  return tiles.filter((t) => (!t.adminOnly || isAdmin) && (!t.memberOnly || !isAdmin));
}

type ServicesScreenProps = {
  me: PublicUser;
  /** بخش جزئیات باز از قبل (پرش از جای دیگر پنل) — null یعنی گرید مربع‌ها */
  section: SettingsSection | null;
  onSectionChange: (section: SettingsSection | null) => void;
};

export default function ServicesScreen({ me, section, onSectionChange }: ServicesScreenProps) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const tiles = tilesFor(isAdmin);

  // مودال تأیید خروج از حساب
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);

  function openTile(tile: ServiceTile) {
    if ("logout" in tile.target) {
      setConfirmLogout(true);
      return;
    }
    if ("href" in tile.target) {
      router.push(tile.target.href);
      return;
    }
    onSectionChange(tile.target.section);
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  /* ---------- نمای جزئیات یک بخش (باز شده از گرید یا پرش از جای دیگر) ---------- */
  if (section) {
    return (
      <ServiceDetailScreen
        me={me}
        section={section}
        onBack={() => onSectionChange(null)}
      />
    );
  }

  /* ---------- گرید تخت مربع‌های خدمات ---------- */
  return (
    <div className="space-y-5 px-4 pt-4">
      <div className="grid grid-cols-4 gap-2.5">
        {tiles.map((tile) => {
          const [toneA, toneB] = tile.tone ?? toneForIcon(tile.icon);
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => openTile(tile)}
              style={{ backgroundImage: `linear-gradient(145deg, ${toneA}30 0%, ${toneB}17 55%, transparent 100%)` }}
              className="clay-press flex flex-col items-center gap-2 rounded-3xl border border-zinc-200/70 bg-white px-1.5 py-3.5 shadow-md shadow-primary-900/5 transition hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/10 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <ClayIcon name={tile.icon} size={46} tone={tile.tone} />
              <span className="text-center text-[10.5px] font-medium leading-4 text-zinc-700 dark:text-zinc-300">
                {tile.label}
              </span>
            </button>
          );
        })}
        {/* مربع خروج از حساب — آخر گرید، با تُن قرمز */}
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          style={{ backgroundImage: "linear-gradient(145deg, #FCA9A930 0%, #D9505017 55%, transparent 100%)" }}
          className="clay-press flex flex-col items-center gap-2 rounded-3xl border border-red-200/70 bg-white px-1.5 py-3.5 shadow-md shadow-primary-900/5 transition hover:border-red-300 hover:shadow-lg hover:shadow-primary-900/10 dark:border-red-900 dark:bg-zinc-950"
        >
          <ClayIcon name="logout" size={46} tone={["#FCA9A9", "#D95050"]} />
          <span className="text-center text-[10.5px] font-medium leading-4 text-red-700 dark:text-red-400">
            خروج از حساب
          </span>
        </button>
      </div>

      <p className="pb-2 text-center text-[11px] leading-6 text-zinc-400">
        برای هر خدمت فقط کافی است مربعش را بزنید؛ مستقیم به همان بخش می‌روید.
      </p>

      {/* مودال تأیید خروج */}
      {confirmLogout && (
        <div data-swipe-ignore className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <ClayIcon name="logout" size={48} tone={["#FCA9A9", "#D95050"]} />
            <h3 className="mt-3 text-sm font-bold">خروج از حساب</h3>
            <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              مطمئنید که می‌خواهید از فَم بانک خارج شوید؟
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "در حال خروج…" : "خروج"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
