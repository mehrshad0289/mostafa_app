"use client";

import { useEffect, useState } from "react";
import ClayIcon, { type ClayIconName } from "./ClayIcon";
import HouseLogo from "./HouseLogo";
import MemberGuide from "./SystemGuide";
import BackupSection from "./BackupSection";
import MessagesSection from "./MessagesSection";
import AppearanceSettings from "@/app/components/bank/AppearanceSettings";
import type { SettingsSection } from "./nav";
import type { BankSettings, PublicUser } from "@/lib/db";

/**
 * نمایش جزئیات یکی از بخش‌های «خدمات» — جلسه ۵۲: صفحهٔ «تنظیمات» حذف شد و
 * همهٔ آیتم‌هایش مربع‌های گرید خدمات شدند (ServicesScreen)؛ این کامپوننت فقط
 * محتوای هر مربع را با دکمهٔ بازگشت نشان می‌دهد
 * (پروفایل، امنیت و رمز، پیام‌ها، پشتیبان‌گیری، ظاهر، اطلاعات واریز،
 * تنظیمات بانک، راهنما، درباره).
 */

type Props = {
  me: PublicUser;
  /** بخش باز شده از گرید خدمات — همیشه non-null */
  section: SettingsSection;
  onBack: () => void;
};

type SectionDef = {
  key: SettingsSection;
  title: string;
  icon: ClayIconName;
  adminOnly?: boolean;
  /** فقط برای اعضا — مدیر نمی‌بیند (مثل پیام‌رسان عضو، جلسه ۵۰) */
  memberOnly?: boolean;
};

const SECTION_DEFS: SectionDef[] = [
  { key: "profile", title: "پروفایل من", icon: "user" },
  { key: "security", title: "امنیت و رمز عبور", icon: "shield" },
  { key: "messages", title: "پیام‌ها", icon: "note", memberOnly: true },
  { key: "backup", title: "پشتیبان‌گیری اطلاعات", icon: "download" },
  { key: "appearance", title: "ظاهر اپلیکیشن", icon: "palette" },
  { key: "deposits", title: "اطلاعات واریز", icon: "wallet" },
  { key: "fund", title: "تنظیمات بانک", icon: "settings", adminOnly: true },
  { key: "guide", title: "راهنما", icon: "info" },
  { key: "about", title: "درباره فَم بانک", icon: "info" },
];

export function sectionTitle(section: SettingsSection): string {
  return SECTION_DEFS.find((d) => d.key === section)?.title ?? "خدمات";
}

function fa(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

function formatCard(card: string): string {
  return card.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatSheba(sheba: string): string {
  return sheba.replace(/(.{4})(?=\S)/g, "$1 ").trim();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-zinc-800 dark:focus:ring-primary-500/20";

export default function ServiceDetailScreen({ me, section, onBack }: Props) {
  const isAdmin = me.role === "admin";
  const [copiedKey, setCopiedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // فرم تغییر رمز
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwError, setPwError] = useState("");

  // تنظیمات بانک (برای اطلاعات واریز و بخش بانک)
  const [settings, setSettings] = useState<BankSettings | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/bank/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (alive) setSettings(s && typeof s === "object" ? s : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [section]);

  async function copy(key: string, text: string) {
    const ok = await copyText(text);
    setCopiedKey(ok ? key : "");
    setNotice(ok ? "کپی شد." : "کپی ناموفق بود.");
    if (ok) setTimeout(() => setCopiedKey(""), 1800);
  }

  async function submitChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (pwNew !== pwNew2) {
      setPwError("تکرار رمز جدید با رمز جدید یکسان نیست.");
      return;
    }
    setBusy(true);
    setPwError("");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPwError(data.error || "تغییر رمز ناموفق بود.");
        return;
      }
      setPwCurrent("");
      setPwNew("");
      setPwNew2("");
      setNotice("رمز عبور با موفقیت عوض شد.");
    } catch {
      setPwError("تغییر رمز ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const def = SECTION_DEFS.find((d) => d.key === section);

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="بازگشت به خدمات"
          className="clay-press grid size-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <ClayIcon name="chevron-right" size={24} ghost ghostColor="#334155" />
        </button>
        <h2 className="text-base font-bold">{def?.title ?? "خدمات"}</h2>
      </div>

      {notice && (
        <p className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {section === "profile" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {/* جلسه ۴۱: آواتار پروفایل دقیقاً هم‌رنگ زمینهٔ لوگو شد — همان
                گرادیان سرمه‌ایِ پس‌زمینهٔ HouseLogo (#212F5A→#0F1B3D) */}
            <span
              className="clay"
              style={{
                width: 52,
                height: 52,
                background: "linear-gradient(140deg, #212F5A 0%, #0F1B3D 78%)",
              }}
            >
              <span className="relative z-10 text-base font-bold text-white">
                {(me.fullName || me.username).trim().charAt(0)}
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{me.fullName || me.username}</p>
              <p dir="ltr" className="text-right text-[11px] text-zinc-500">
                @{me.username}
              </p>
            </div>
            {/* نشان نقش فقط برای «مدیر» — کلمه «عضو» حذف شد (درخواست کاربر، جلسه ۳۲) */}
            {isAdmin && (
              <span className="mr-auto rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                مدیر
              </span>
            )}
          </div>
          <dl className="divide-y divide-zinc-100 rounded-3xl border border-zinc-200 bg-white px-4 text-sm shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:py-3">
            <div>
              <dt className="text-xs text-zinc-500">نام و نام خانوادگی</dt>
              <dd className="font-medium">{me.fullName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">شماره تلفن</dt>
              <dd dir="ltr" className="font-medium">
                {me.phone || "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {section === "security" && (
        <form onSubmit={submitChangePassword} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <label className="block space-y-1 text-xs text-zinc-500">
            رمز فعلی
            <input
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              dir="ltr"
              autoComplete="current-password"
              className={`${inputClass} text-left`}
              required
            />
          </label>
          <label className="block space-y-1 text-xs text-zinc-500">
            رمز جدید (حداقل ۶ نویسه)
            <input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              dir="ltr"
              autoComplete="new-password"
              className={`${inputClass} text-left`}
              required
            />
          </label>
          <label className="block space-y-1 text-xs text-zinc-500">
            تکرار رمز جدید
            <input
              type="password"
              value={pwNew2}
              onChange={(e) => setPwNew2(e.target.value)}
              dir="ltr"
              autoComplete="new-password"
              className={`${inputClass} text-left`}
              required
            />
          </label>
          {pwError && <p className="text-xs text-red-600 dark:text-red-400">{pwError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-l from-primary-700 to-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25 disabled:opacity-50"
          >
            {busy ? "در حال ذخیره…" : "تغییر رمز عبور"}
          </button>
        </form>
      )}

      {section === "backup" && (
        <BackupSection />
      )}

      {/* جلسه ۵۰ — پیام‌رسان عضو ↔ مدیر؛ از جلسه ۵۲ مربع «پیام‌ها» در خدمات */}
      {section === "messages" && <MessagesSection />}

      {section === "appearance" && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <AppearanceSettings />
        </div>
      )}

      {section === "deposits" && (
        <div className="space-y-3">
          {(() => {
            const accounts = settings?.depositAccounts;
            const primary = accounts?.primary;
            const alternate = accounts?.alternate;
            const hasPrimary = Boolean(
              primary && (primary.bankName || primary.holder || primary.cardNumber || primary.sheba),
            );
            const hasAlternate = Boolean(
              alternate && (alternate.bankName || alternate.holder || alternate.cardNumber || alternate.sheba),
            );
            if (!hasPrimary && !hasAlternate) {
              return (
                <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <ClayIcon name="wallet" size={52} className="mx-auto opacity-90" />
                  <p className="mt-3 text-xs leading-6 text-zinc-500">
                    هنوز اطلاعات حساب توسط مدیر ثبت نشده است؛ با مدیر بانک تماس بگیرید.
                  </p>
                </div>
              );
            }
            const block = (
              title: string,
              acc: { bankName?: string; holder: string; cardNumber: string; sheba: string },
              accent: boolean,
              key: string,
            ) => (
              <div
                className={`rounded-3xl border p-4 shadow-sm ${
                  accent
                    ? "border-primary-200 bg-gradient-to-bl from-primary-50 to-white dark:border-primary-900 dark:from-primary-950/50 dark:to-zinc-950"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                <p className="mb-2 text-[11px] font-bold text-zinc-500">{title}</p>
                {acc.bankName && (
                  <p className="text-sm font-bold">نام بانک: {acc.bankName}</p>
                )}
                <p className="mt-1 text-sm font-bold">{acc.holder || "—"}</p>
                {acc.cardNumber && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span dir="ltr" className="text-[13px] font-semibold tracking-wider">
                      {formatCard(acc.cardNumber)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(`${key}-card`, acc.cardNumber)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 dark:border-zinc-700"
                    >
                      {copiedKey === `${key}-card` ? "کپی شد" : "کپی"}
                    </button>
                  </div>
                )}
                {acc.sheba && (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span dir="ltr" className="truncate text-[11px] text-zinc-500">
                      {formatSheba(acc.sheba)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(`${key}-sheba`, acc.sheba)}
                      className="shrink-0 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 dark:border-zinc-700"
                    >
                      {copiedKey === `${key}-sheba` ? "کپی شد" : "کپی"}
                    </button>
                  </div>
                )}
              </div>
            );
            return (
              <>
                {hasPrimary && block("اطلاعات اصلی — واریز به این حساب", primary!, true, "primary")}
                {hasAlternate && block("اطلاعات جایگزین — در صورت نیاز", alternate!, false, "alternate")}
              </>
            );
          })()}
        </div>
      )}

      {section === "fund" && (
        <div className="space-y-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-bold text-zinc-500">سقف سهام ماهانه</p>
            <p className="mt-1 text-lg font-black">{settings ? `${fa(settings.amountPerShare)} تومان` : "…"}</p>
            <p className="mt-3 text-xs font-bold text-zinc-500">عنوان‌های واریز</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {settings?.depositTitles.map((t) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <a
            href="/admin"
            className="clay-press flex items-center justify-between rounded-3xl border border-primary-200 bg-gradient-to-bl from-primary-50 to-white p-4 shadow-sm dark:border-primary-900 dark:from-primary-950/50 dark:to-zinc-950"
          >
            <div className="flex items-center gap-3">
              <ClayIcon name="building" size={44} />
              <div>
                <p className="text-sm font-bold">پنل مدیریت کامل</p>
                <p className="text-[10.5px] text-zinc-500">اعضا، وام‌ها، گزارش‌ها و پشتیبان‌گیری</p>
              </div>
            </div>
            <ClayIcon name="chevron-left" size={22} ghost ghostColor="#94a3b8" />
          </a>
        </div>
      )}

      {section === "guide" && (
        <MemberGuide />
      )}

      {section === "about" && (
        <div className="space-y-3">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-bl from-primary-50 to-white p-6 text-center shadow-sm dark:border-zinc-800 dark:from-primary-950/50 dark:to-zinc-950">
            <span className="mx-auto block w-fit">
              <HouseLogo size={64} />
            </span>
            <p className="mt-3 text-base font-black">فَم بانک</p>
            <p dir="ltr" className="mt-0.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
              Fam Bank
            </p>
            <p className="mt-2 text-xs text-zinc-500">نسخه ۱٫۰٫۰ — رابط موبایل</p>
            <p className="mt-3 text-[11px] leading-6 text-zinc-500">
              اپلیکیشن مدیریت بانک خانوادگی: سهام، اقساط، تسهیلات و گزارش‌ها —
              با ظاهری ساده و امن برای همه اعضا.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
