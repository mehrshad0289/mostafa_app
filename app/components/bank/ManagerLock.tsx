"use client";

import { useEffect, useState } from "react";
import { normalizeDigits, sha256Hex } from "@/lib/bank";
import { useHydrated } from "./useHydrated";

type ManagerLockProps = {
  onUnlock: () => void;
};

/** کلید هش PIN در localStorage — جدا از داده‌ها (داده سرور در db.json است) */
const PIN_HASH_KEY = "mostafa_bank_pin_hash";

export default function ManagerLock({ onUnlock }: ManagerLockProps) {
  const hydrated = useHydrated();
  const [hasHash, setHasHash] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    try {
      setHasHash(!!window.localStorage.getItem(PIN_HASH_KEY));
    } catch {
      setHasHash(false);
    }
  }, [hydrated]);

  const cleanedPin = normalizeDigits(pin).trim();

  async function handleSetPin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{4,}$/.test(cleanedPin)) {
      setError("PIN باید حداقل ۴ رقم و فقط رقم باشد.");
      return;
    }
    if (cleanedPin !== normalizeDigits(pinConfirm).trim()) {
      setError("تأیید PIN با PIN مطابقت ندارد.");
      return;
    }
    setBusy(true);
    try {
      window.localStorage.setItem(PIN_HASH_KEY, await sha256Hex(cleanedPin));
      onUnlock();
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const stored = window.localStorage.getItem(PIN_HASH_KEY) ?? "";
      if ((await sha256Hex(cleanedPin)) === stored) {
        onUnlock();
        return;
      }
      setError("PIN اشتباه است.");
    } finally {
      setBusy(false);
    }
  }

  function resetPin() {
    try {
      window.localStorage.removeItem(PIN_HASH_KEY);
    } catch {
      // localStorage در دسترس نیست — فقط قفل ظاهری را می‌بندیم
    }
    onUnlock();
  }

  if (!hydrated || hasHash === null) {
    return (
      <p className="text-sm text-zinc-500">در حال آماده‌سازی قفل…</p>
    );
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-medium">قفل مدیر</h2>
      <p className="text-xs text-zinc-500">
        این قفل فقط ظاهری است (مطابق نمونه) — امنیت سروری نیست و داده‌های صندوق
        در سرور باقی می‌مانند.
      </p>

      {hasHash ? (
        <form onSubmit={handleUnlock} className="space-y-3">
          <label className="block space-y-1 text-xs text-zinc-500">
            PIN مدیر
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            باز کردن قفل
          </button>
        </form>
      ) : (
        <form onSubmit={handleSetPin} className="space-y-3">
          <label className="block space-y-1 text-xs text-zinc-500">
            تعیین PIN (حداقل ۴ رقم)
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
          </label>
          <label className="block space-y-1 text-xs text-zinc-500">
            تأیید PIN
            <input
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              dir="ltr"
              className={`${inputClass} w-full text-left`}
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ذخیره PIN و فعال‌سازی قفل
          </button>
        </form>
      )}

      {hasHash &&
        (resetConfirm ? (
          <div className="space-y-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
            <p>PIN پاک شود؟ قفل حذف می‌شود و می‌توانید PIN جدید تعیین کنید.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetPin}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white"
              >
                بله، پاک کردن PIN
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setResetConfirm(true)}
            className="text-xs text-zinc-500 underline underline-offset-4"
          >
            PIN را فراموش کرده‌ام — پاک کردن قفل
          </button>
        ))}
    </div>
  );
}
