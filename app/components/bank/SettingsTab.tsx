"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { jalaliParts, parseAmount } from "@/lib/bank";
import type { BankSettings } from "@/lib/db";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  /** همگام‌سازی فرم با تنظیمات سرور پس از هر refresh — الگوی رسمی React:
      تنظیم state هنگام رندر با مقایسه مقدار قبلی (بدون effect) */
  if (settings && settings !== synced) {
    setSynced(settings);
    setAmount(settings.amountPerShare ? String(settings.amountPerShare) : "");
    setTitles([...(settings.depositTitles ?? [])]);
    setWarn(settings.duplicateWarning !== false);
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

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium">پشتیبان‌گیری و بازیابی</h3>
        <p className="text-xs text-zinc-500">
          قبل از بازیابی، از وضعیت فعلی پشتیبان بگیر — بازیابی کل داده بانک
          (اعضا، واریزی‌ها، وام‌ها و سوابق) را با محتوای فایل جایگزین می‌کند.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadBackup}
            disabled={busy}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            دریافت پشتیبان JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
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
    </div>
  );
}
