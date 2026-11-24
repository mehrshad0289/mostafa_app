"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** صفحه ورود: نام کاربری + رمز → ادمین به /admin و عضو به /dashboard می‌رود */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // کلید موقت ورود بدون رمز ادمین در route سرور می‌ماند؛ در UI هیچ نشانه‌ای از آن
  // نمایش داده نمی‌شود تا بازدیدکنندگان سایت از وجود آن خبره نشوند
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as {
        user?: { role: "admin" | "member" };
        error?: string;
      };
      if (!response.ok || !data.user) {
        setError(data.error || "نام کاربری یا رمز عبور اشتباه است");
        return;
      }
      router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-3 text-sm dark:border-zinc-800";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black dark:text-zinc-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-medium">ورود به Mostafa App</h1>
          <p className="text-xs text-zinc-500">
            با نام کاربری و رمز عبور خود وارد شوید.
          </p>
        </div>
        <label className="block space-y-1 text-xs text-zinc-500">
          نام کاربری
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            autoComplete="username"
            className={`${inputClass} text-left`}
          />
        </label>
        <label className="block space-y-1 text-xs text-zinc-500">
          رمز عبور
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="current-password"
            className={`${inputClass} text-left`}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "در حال ورود…" : "ورود"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          حساب ندارید؟{" "}
          <Link href="/register" className="font-medium text-zinc-700 underline dark:text-zinc-300">
            ثبت‌نام کنید
          </Link>
        </p>
      </form>
    </main>
  );
}
