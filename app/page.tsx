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
          router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black dark:text-zinc-50">
      <p className="text-sm text-zinc-500">در حال انتقال…</p>
    </main>
  );
}
