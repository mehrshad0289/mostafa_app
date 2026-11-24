"use client";

import { useEffect, useState } from "react";
import { parseAmount } from "@/lib/bank";
import type { BankSettings } from "@/lib/db";
import { useHydrated } from "./useHydrated";

type SettingsTabProps = {
  settings: BankSettings | null;
  onRefresh: () => void;
};

export default function SettingsTab({ settings, onRefresh }: SettingsTabProps) {
  const hydrated = useHydrated();
  const [amount, setAmount] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [warn, setWarn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  /** همگام‌سازی فرم با تنظیمات سرور پس از هر refresh */
  useEffect(() => {
    if (!hydrated || !settings) return;
    setAmount(settings.amountPerShare ? String(settings.amountPerShare) : "");
    setTitles([...(settings.depositTitles ?? [])]);
    setWarn(settings.duplicateWarning !== false);
  }, [hydrated, settings]);

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

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</p>
      )}

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
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ذخیره مبلغ سهم
          </button>
        </form>
      </section>

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
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            افزودن عنوان
          </button>
        </form>
      </section>

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
    </div>
  );
}
