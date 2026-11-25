"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { jalaliParts, parseAmount } from "@/lib/bank";
import ClayIcon, { type ClayIconName } from "@/app/components/mobile/ClayIcon";
import type { BankSettings, DepositAccount } from "@/lib/db";
import AppearanceSettings from "./AppearanceSettings";

/**
 * سر بخش‌های تنظیمات — جلسه ۲۶: لیست سر بخش‌ها؛ زیرمجموعه هر بخش فقط با
 * ورود به آن دیده می‌شود (هم‌الگوی SettingsScreen پوسته موبایل).
 */
type SettingsSectionKey =
  | "appearance"
  | "shareAmount"
  | "depositAccounts"
  | "depositTitles"
  | "duplicateWarning"
  | "backup";

const SETTINGS_SECTIONS: {
  key: SettingsSectionKey;
  title: string;
  subtitle: string;
  icon: ClayIconName;
}[] = [
  { key: "shareAmount", title: "مبلغ هر سهم", subtitle: "مبنای تعهد ماهانه اعضا و پرداخت سهم ماهانه", icon: "coins" },
  { key: "depositAccounts", title: "حساب‌های واریز اعضا", subtitle: "کارت و شبا اصلی و جایگزین برای واریز اعضا", icon: "wallet" },
  { key: "depositTitles", title: "عنوان‌های آماده واریز", subtitle: "پیشنهاد فرم ثبت واریزی — عنوان آزاد هم ممکن است", icon: "receipt" },
  { key: "duplicateWarning", title: "هشدار تراکنش مشابه", subtitle: "تأیید پیش از ثبت واریزی مشابه", icon: "bell" },
  { key: "backup", title: "پشتیبان‌گیری و بازیابی", subtitle: "دانلود JSON پشتیبان و بازیابی کامل داده بانک", icon: "download" },
  { key: "appearance", title: "ظاهر اپلیکیشن", subtitle: "تم رنگی، فونت و حالت نمایش", icon: "palette" },
];

type SettingsTabProps = {
  settings: BankSettings | null;
  onRefresh: () => void;
};

export default function SettingsTab({ settings, onRefresh }: SettingsTabProps) {
  const [synced, setSynced] = useState<BankSettings | null>(null);
  const [amount, setAmount] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [warn, setWarn] = useState(true);
  const [accPrimary, setAccPrimary] = useState<DepositAccount>({
    holder: "",
    cardNumber: "",
    sheba: "",
  });
  const [accAlternate, setAccAlternate] = useState<DepositAccount>({
    holder: "",
    cardNumber: "",
    sheba: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  /** سر بخش باز — null یعنی فهرست اصلی تنظیمات */
  const [section, setSection] = useState<SettingsSectionKey | null>(null);

  /** همگام‌سازی فرم با تنظیمات سرور پس از هر refresh — الگوی رسمی React:
      تنظیم state هنگام رندر با مقایسه مقدار قبلی (بدون effect) */
  if (settings && settings !== synced) {
    setSynced(settings);
    setAmount(settings.amountPerShare ? String(settings.amountPerShare) : "");
    setTitles([...(settings.depositTitles ?? [])]);
    setWarn(settings.duplicateWarning !== false);
    setAccPrimary({ ...settings.depositAccounts?.primary });
    setAccAlternate({ ...settings.depositAccounts?.alternate });
  }

  const fileRef = useRef<HTMLInputElement>(null);
  /** فایل پشتیبان انتخاب‌شده و منتظر تأیید بازیابی */
  const [pendingRestore, setPendingRestore] = useState<{
    name: string;
    summary: string;
    text: string;
  } | null>(null);

  /** نام فایل پشتیبان با تاریخ شمسی — هم‌نام با Content-Disposition سرور */
  function backupFileName(): string {
    const { year, month, day } = jalaliParts(new Date());
    const p = (n: number) => String(n).padStart(2, "0");
    return `پشتیبان-فم-بانک-${year}-${p(month)}-${p(day)}.json`;
  }

  /** دریافت پشتیبان JSON از سرور و دانلود با نام تاریخ‌دار */
  async function downloadBackup() {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/bank/backup");
      if (!response.ok) throw new Error("backup failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSaved("فایل پشتیبان دانلود شد.");
    } catch {
      setError("دریافت فایل پشتیبان ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  /** انتخاب فایل برای بازیابی — فقط خلاصه نمایش داده می‌شود؛ اعتبارسنجی کامل سمت سرور است */
  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setSaved("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const bank = (
        raw && typeof raw === "object" && "bank" in (raw as object)
          ? (raw as { bank: unknown }).bank
          : raw
      ) as { members?: unknown[]; deposits?: unknown[]; loans?: unknown[] } | null;
      if (!bank || typeof bank !== "object") throw new Error("invalid shape");
      setPendingRestore({
        name: file.name,
        summary: `${(bank.members?.length ?? 0).toLocaleString("fa-IR")} عضو، ${(bank.deposits?.length ?? 0).toLocaleString("fa-IR")} واریزی، ${(bank.loans?.length ?? 0).toLocaleString("fa-IR")} وام`,
        text,
      });
    } catch {
      setError("فایل انتخاب‌شده JSON معتبر نیست.");
    }
  }

  /** تأیید نهایی بازیابی — کل داده بانک با محتوای فایل جایگزین می‌شود */
  async function confirmRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/bank/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingRestore.text,
      });
      const data = (await response.json()) as {
        error?: string;
        counts?: { members: number; deposits: number; loans: number };
      };
      if (!response.ok) {
        setError(data.error || "بازیابی پشتیبان ناموفق بود.");
        return;
      }
      setPendingRestore(null);
      setSaved(
        `بازیابی انجام شد: ${(data.counts?.members ?? 0).toLocaleString("fa-IR")} عضو، ${(data.counts?.deposits ?? 0).toLocaleString("fa-IR")} واریزی، ${(data.counts?.loans ?? 0).toLocaleString("fa-IR")} وام.`,
      );
      onRefresh();
    } catch {
      setError("بازیابی پشتیبان ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function putSettings(patch: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bank/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ذخیره تنظیمات ناموفق بود.");
        return false;
      }
      setSaved("ذخیره شد.");
      onRefresh();
      return true;
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveAmount(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    const value = parseAmount(amount);
    if (!(value > 0)) {
      setError("مبلغ هر سهم باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    await putSettings({ amountPerShare: value });
  }

  async function addTitle(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    const title = newTitle.trim();
    if (!title) {
      setError("عنوان جدید را وارد کنید.");
      return;
    }
    if (titles.includes(title)) {
      setError("این عنوان قبلاً وجود دارد.");
      return;
    }
    if (await putSettings({ depositTitles: [...titles, title] })) {
      setNewTitle("");
    }
  }

  async function removeTitle(title: string) {
    setSaved("");
    await putSettings({
      depositTitles: titles.filter((t) => t !== title),
    });
  }

  async function toggleWarning(checked: boolean) {
    setSaved("");
    setWarn(checked);
    await putSettings({ duplicateWarning: checked });
  }

  /** ذخیره حساب اصلی و جایگزین واریز — اعتبارسنجی شماره کارت/شبا سمت سرور است */
  async function saveAccounts(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    await putSettings({
      depositAccounts: { primary: accPrimary, alternate: accAlternate },
    });
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  const sectionMeta = section
    ? SETTINGS_SECTIONS.find((s) => s.key === section) ?? null
    : null;

  /* ---------- نمای جزئیات: زیرمجموعه فقط با ورود به سر بخش ---------- */
  if (sectionMeta) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSection(null)}
            aria-label="بازگشت به فهرست تنظیمات"
            className="clay-press grid size-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <ClayIcon name="chevron-right" size={24} ghost ghostColor="#334155" />
          </button>
          <h2 className="text-base font-bold">{sectionMeta.title}</h2>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</p>
        )}

        {section === "appearance" && <AppearanceSettings />}

        {section === "shareAmount" && (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">مبلغ هر سهم</h3>
        <p className="text-xs text-zinc-500">
          مبنای محاسبه تعهد ماهانه اعضا و دکمه «پرداخت سهم ماهانه» است.
        </p>
        <form onSubmit={saveAmount} className="flex flex-wrap items-center gap-2">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="۱٬۰۰۰٬۰۰۰"
            className={`${inputClass} w-48`}
          />
          <span className="text-xs text-zinc-500">تومان</span>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
          >
            ذخیره مبلغ سهم
          </button>
        </form>
      </section>
        )}

        {section === "depositAccounts" && (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">حساب‌های واریز اعضا</h3>
        <p className="text-xs text-zinc-500">
          شماره کارت، شماره شبا و نام صاحب حساب را ثبت کنید تا اعضا در تب «واریز»
          پنل خود ببینند و به همان حساب واریز کنند. اگر حساب جایگزین ندارید،
          خالی بگذارید.
        </p>
        <form onSubmit={saveAccounts} className="space-y-4">
          <fieldset className="space-y-2 rounded-xl border border-primary-200 p-3 dark:border-primary-900">
            <legend className="px-1 text-xs font-medium text-primary-700 dark:text-primary-300">
              اطلاعات اصلی
            </legend>
            <input
              value={accPrimary.holder}
              onChange={(e) => setAccPrimary({ ...accPrimary, holder: e.target.value })}
              placeholder="نام صاحب حساب اصلی"
              className={`${inputClass} w-full`}
            />
            <input
              value={accPrimary.cardNumber}
              onChange={(e) => setAccPrimary({ ...accPrimary, cardNumber: e.target.value })}
              placeholder="شماره کارت اصلی — ۱۶ رقم"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
            <input
              value={accPrimary.sheba}
              onChange={(e) => setAccPrimary({ ...accPrimary, sheba: e.target.value })}
              placeholder="شماره شبا اصلی — IR و ۲۴ رقم"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
          </fieldset>
          <fieldset className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-medium text-zinc-500">
              اطلاعات جایگزین
            </legend>
            <input
              value={accAlternate.holder}
              onChange={(e) => setAccAlternate({ ...accAlternate, holder: e.target.value })}
              placeholder="نام صاحب حساب جایگزین"
              className={`${inputClass} w-full`}
            />
            <input
              value={accAlternate.cardNumber}
              onChange={(e) => setAccAlternate({ ...accAlternate, cardNumber: e.target.value })}
              placeholder="شماره کارت جایگزین — ۱۶ رقم"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
            <input
              value={accAlternate.sheba}
              onChange={(e) => setAccAlternate({ ...accAlternate, sheba: e.target.value })}
              placeholder="شماره شبا جایگزین — IR و ۲۴ رقم"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
          </fieldset>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
          >
            ذخیره حساب‌های واریز
          </button>
        </form>
      </section>
        )}

        {section === "depositTitles" && (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">عنوان‌های آماده واریزی</h3>
        <p className="text-xs text-zinc-500">
          این عنوان‌ها در فرم واریزی پیشنهاد می‌شوند؛ عنوان آزاد همیشه هم ممکن
          است.
        </p>
        <ul className="flex flex-wrap gap-2">
          {titles.map((title) => (
            <li
              key={title}
              className="flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800"
            >
              {title}
              <button
                type="button"
                onClick={() => removeTitle(title)}
                disabled={busy}
                title={`حذف عنوان ${title}`}
                className="text-red-600 transition-colors hover:text-red-500 disabled:opacity-40 dark:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
          {titles.length === 0 && (
            <li className="text-xs text-zinc-500">عنوانی ثبت نشده است.</li>
          )}
        </ul>
        <form onSubmit={addTitle} className="flex flex-wrap items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان جدید، مثل «کمک دلخواه»"
            className={`${inputClass} w-56`}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
          >
            افزودن عنوان
          </button>
        </form>
      </section>
        )}

        {section === "duplicateWarning" && (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">هشدار تراکنش مشابه</h3>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={warn}
            onChange={(e) => toggleWarning(e.target.checked)}
            disabled={busy}
            className="mt-1"
          />
          <span>
            پیش از ثبت واریزی مشابه (همان عضو + مبلغ + ماه) تأیید گرفته شود.
            <span className="block text-xs text-zinc-500">
              خاموش کردن آن ثبت را سریع‌تر می‌کند؛ هشدار پیش‌فرض روشن است.
            </span>
          </span>
        </label>
      </section>
        )}

        {section === "backup" && (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">پشتیبان‌گیری و بازیابی</h3>
        <p className="text-xs text-zinc-500">
          قبل از بازیابی، از وضعیت فعلی پشتیبان بگیر — بازیابی کل داده بانک
          (اعضا، تراکنش‌ها، وام‌ها و سوابق) را با محتوای فایل جایگزین می‌کند.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadBackup}
            disabled={busy}
            className="rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
          >
            دریافت پشتیبان JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-primary-400 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
          >
            بازیابی از فایل…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFilePicked}
          />
        </div>
        {pendingRestore && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <p>
              فایل «{pendingRestore.name}» شامل {pendingRestore.summary} است —
              با بازیابی، همه داده فعلی جایگزین می‌شود. ادامه می‌دهید؟
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmRestore}
                disabled={busy}
                className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                بله، بازیابی کن
              </button>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={busy}
                className="rounded-xl border border-amber-300 px-3 py-1.5 text-xs dark:border-amber-800"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {saved}
          </p>
        )}
      </section>
        )}
      </div>
    );
  }

  /* ---------- فهرست اصلی تنظیمات: سر بخش‌ها بدون زیرمجموعه ---------- */
  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</p>
      )}

      <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {SETTINGS_SECTIONS.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => setSection(row.key)}
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

      <p className="text-center text-[11px] leading-6 text-zinc-400">
        برای دیدن و ویرایش هر بخش، از فهرست وارد آن شوید؛ جزئیات فقط داخل همان بخش باز می‌شود.
      </p>
    </div>
  );
}
