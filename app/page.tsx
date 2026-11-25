"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * صفحه اصلی: اگر لاگین بود به پنل خودش (ادمین → /admin، عضو → /dashboard)
 * وگرنه به /login هدایت می‌شود. صفحه یادداشت‌های حقیقی در /haqiqi باقی است.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user?: { role: "admin" | "member" } | null }) => {
        if (!alive) return;
        if (!data.user) {
          router.replace("/login");
        } else {
          // جلسه بیست‌وسوم: عضو به پوسته موبایل جدید (/mobile) می‌رود؛ ادمین به پنل خودش
          router.replace(data.user.role === "admin" ? "/admin" : "/mobile");
        }
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-100/70 via-zinc-50 to-zinc-50 p-4 dark:from-zinc-950 dark:via-black dark:to-black dark:text-zinc-50">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-600 text-2xl font-bold text-white shadow-lg shadow-primary-600/30 dark:bg-primary-500">
        م
      </span>
      <p className="text-sm text-zinc-500">در حال انتقال…</p>
    </main>
  );
}
