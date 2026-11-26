"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClayIcon, { NAVY_TONE, type ClayIconName } from "./ClayIcon";
import HouseLogo from "./HouseLogo";
import AppearanceSettings from "@/app/components/bank/AppearanceSettings";
import type { SettingsSection } from "./nav";
import type { BankSettings, PublicUser } from "@/lib/db";

/**
 * اسلاید تنظیمات — لیست زیبا از بخش‌ها؛ با زدن هر آیتم وارد جزئیاتش می‌شویم
 * (پروفایل، امنیت و رمز، ظاهر و تم، حساب‌های واریز، تنظیمات بانک، درباره).
 */

type Props = {
  me: PublicUser;
  /** بخش باز از قبل (پرش از خدمات) — null یعنی لیست اصلی */
  section: SettingsSection | null;
  onSectionChange: (section: SettingsSection | null) => void;
};

type RowDef = {
  key: SettingsSection;
  title: string;
  subtitle: string;
  icon: ClayIconName;
  adminOnly?: boolean;
};

const ROWS: RowDef[] = [
  { key: "profile", title: "پروفایل من", subtitle: "نام، نام کاربری و اطلاعات حساب", icon: "user" },
  { key: "security", title: "امنیت و رمز عبور", subtitle: "تغییر رمز ورود به اپ", icon: "shield" },
  { key: "appearance", title: "ظاهر اپلیکیشن", subtitle: "تم رنگی، فونت و حالت نمایش", icon: "palette" },
  { key: "deposits", title: "حساب‌های واریز", subtitle: "شماره کارت و شبا برای واریز به بانک", icon: "wallet" },
  { key: "fund", title: "تنظیمات بانک", subtitle: "سقف سهام، عنوان‌های واریز و پنل مدیریت", icon: "building", adminOnly: true },
  { key: "about", title: "درباره فم بانک", subtitle: "نسخه اپ و معرفی", icon: "info" },
];

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

export default function SettingsScreen({ me, section, onSectionChange }: Props) {
  const router = useRouter();
  const isAdmin = me.role === "admin";
  const [copiedKey, setCopiedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);

  // فرم تغییر رمز
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwError, setPwError] = useState("");

  // تنظیمات بانک (برای حساب‌های واریز و بخش بانک)
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

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const rows = useMemo(() => ROWS.filter((r) => !r.adminOnly || isAdmin), [isAdmin]);

  /* ---------- نمای جزئیات ---------- */
  if (section) {
    const def = ROWS.find((r) => r.key === section);
    return (
      <div className="px-4 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSectionChange(null)}
            aria-label="بازگشت به تنظیمات"
            className="clay-press grid size-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <ClayIcon name="chevron-right" size={24} ghost ghostColor="#334155" />
          </button>
          <h2 className="text-base font-bold">{def?.title ?? "تنظیمات"}</h2>
        </div>

        {notice && (
          <p className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        )}

        {section === "profile" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              {/* جلسه ۳۷: آواتار پروفایل هم‌رنگ آیکون سورمه‌ای (به درخواست کاربر) */}
              <span
                className="clay"
                style={{
                  width: 52,
                  height: 52,
                  background: `linear-gradient(140deg, ${NAVY_TONE[0]}, ${NAVY_TONE[1]})`,
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
              const hasPrimary = Boolean(primary && (primary.holder || primary.cardNumber || primary.sheba));
              const hasAlternate = Boolean(alternate && (alternate.holder || alternate.cardNumber || alternate.sheba));
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
              const block = (title: string, acc: { holder: string; cardNumber: string; sheba: string }, accent: boolean, key: string) => (
                <div
                  className={`rounded-3xl border p-4 shadow-sm ${
                    accent
                      ? "border-primary-200 bg-gradient-to-bl from-primary-50 to-white dark:border-primary-900 dark:from-primary-950/50 dark:to-zinc-950"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
                  <p className="mb-2 text-[11px] font-bold text-zinc-500">{title}</p>
                  <p className="text-sm font-bold">{acc.holder || "—"}</p>
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

        {section === "about" && (
          <div className="space-y-3">
            <div className="rounded-3xl border border-zinc-200 bg-gradient-to-bl from-primary-50 to-white p-6 text-center shadow-sm dark:border-zinc-800 dark:from-primary-950/50 dark:to-zinc-950">
              <span className="mx-auto block w-fit">
                <HouseLogo size={64} />
              </span>
              <p className="mt-3 text-base font-black">فم بانک</p>
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

  /* ---------- لیست اصلی تنظیمات ---------- */
  return (
    <div className="space-y-4 px-4 pt-4">
      {notice && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => onSectionChange(row.key)}
            className="clay-press flex w-full items-center gap-3 p-3.5 text-right transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <ClayIcon name={row.icon} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">{row.title}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">{row.subtitle}</p>
            </div>
            <ClayIcon name="chevron-left" size={22} ghost ghostColor="#94a3b8" />
          </button>
        ))}
      </div>

      {/* خروج از حساب */}
      <button
        type="button"
        onClick={() => setConfirmLogout(true)}
        className="clay-press flex w-full items-center gap-3 rounded-3xl border border-red-200 bg-white p-3.5 text-right shadow-sm dark:border-red-900 dark:bg-zinc-950"
      >
        <ClayIcon name="logout" size={44} tone={["#FCA9A9", "#D95050"]} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-red-700 dark:text-red-400">خروج از حساب</p>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">پایان نشست در این دستگاه</p>
        </div>
      </button>

      <p className="pb-2 text-center text-[10px] text-zinc-400">
        فم بانک · نسخه ۱٫۰٫۰
      </p>

      {/* مودال تأیید خروج */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <ClayIcon name="logout" size={48} tone={["#FCA9A9", "#D95050"]} />
            <h3 className="mt-3 text-sm font-bold">خروج از حساب</h3>
            <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              مطمئنید که می‌خواهید از فم بانک خارج شوید؟
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
