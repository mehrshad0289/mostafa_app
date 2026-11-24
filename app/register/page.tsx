"use client";

import { useState } from "react";
import Link from "next/link";

/** صفحه ثبت‌نام عمومی: حساب جدید پیش‌فرض غیرفعال است تا ادمین فعالش کند */
export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName, phone }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "ثبت‌نام ناموفق بود.");
        return;
      }
      setSuccess(data.message || "ثبت‌نام انجام شد. پس از فعال‌سازی توسط مدیر وارد شوید.");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setFullName("");
      setPhone("");
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-zinc-800 dark:focus:ring-primary-500/20";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary-100/70 via-zinc-50 to-zinc-50 p-4 py-10 dark:from-zinc-950 dark:via-black dark:to-black dark:text-zinc-50">
      <div className="flex flex-col items-center gap-2">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary-600 text-2xl font-bold text-white shadow-lg shadow-primary-600/30 dark:bg-primary-500">
          م
        </span>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Mostafa App</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">ثبت‌نام در Mostafa App</h1>
          <p className="text-xs text-zinc-500">
            حساب شما بعد از ثبت‌نام غیرفعال است و پس از تأیید مدیر فعال می‌شود.
          </p>
        </div>
        <label className="block space-y-1 text-xs text-zinc-500">
          نام کاربری (انگلیسی)
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            autoComplete="username"
            className={`${inputClass} text-left`}
            required
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          رمز عبور (حداقل ۶ نویسه)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            className={`${inputClass} text-left`}
            required
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          تکرار رمز عبور
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            className={`${inputClass} text-left`}
            required
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          نام و نام خانوادگی (اختیاری)
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          شماره تلفن (اختیاری)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white"
        >
          {busy ? "در حال ثبت‌نام…" : "ثبت‌نام"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          حساب دارید؟{" "}
          <Link href="/login" className="font-medium text-primary-700 underline underline-offset-4 dark:text-primary-300">
            وارد شوید
          </Link>
        </p>
      </form>
    </main>
  );
}
