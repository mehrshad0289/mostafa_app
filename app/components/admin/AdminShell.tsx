"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/db";

const MENU: { href: string; label: string }[] = [
  { href: "/admin", label: "نمای کلی" },
  { href: "/admin/users", label: "مدیریت کاربران" },
  { href: "/admin/requests", label: "درخواست‌های اعضا" },
  { href: "/bank?tab=members", label: "اعضا" },
  { href: "/bank?tab=deposits", label: "واریزی‌ها" },
  { href: "/bank?tab=loans", label: "وام‌ها و اقساط" },
  { href: "/bank?tab=reports", label: "گزارش‌ها" },
  { href: "/bank?tab=settings", label: "تنظیمات" },
  { href: "/bank?tab=audit", label: "سوابق" },
];

/**
 * قاب پنل ادمین: گارد دسترسی (غیرادمین → /dashboard و مهمان → /login)،
 * هدر با نام ادمین و دکمه خروج، منوی کناری در دسکتاپ و منوی افقی اسکرول‌شونده در موبایل.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: PublicUser | null }) => {
        if (alive) setMe(d.user ?? null);
      })
      .catch(() => {
        if (alive) setMe(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (me === null) router.replace("/login");
    else if (me && me.role !== "admin") router.replace("/dashboard");
  }, [me, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (me === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black dark:text-zinc-50">
        <p className="text-sm text-zinc-500">در حال بررسی دسترسی…</p>
      </main>
    );
  }
  if (me === null || me.role !== "admin") {
    return null; // در حال ریدایرکت
  }

  const linkClass = (active: boolean) =>
    `block rounded-xl px-3 py-2 text-sm transition ${
      active
        ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black dark:text-zinc-50">
      <header
        className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        data-noprint
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-600 text-white shadow-sm dark:bg-primary-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M3 21h18" />
                <path d="M4 18h16" />
                <path d="M6 18v-7" />
                <path d="M10 18v-7" />
                <path d="M14 18v-7" />
                <path d="M18 18v-7" />
                <path d="M12 3 4 8h16l-8-5Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">Mostafa App</p>
              <h1 className="truncate text-base font-semibold">پنل مدیریت</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="max-w-[10rem] truncate text-xs text-zinc-500">
              {me.fullName || me.username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-xs transition-colors hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:text-red-400"
            >
              خروج
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs ${
                pathname === item.href
                  ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="h-1 bg-gradient-to-l from-primary-700 via-primary-500 to-primary-400" />
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block" data-noprint>
          <nav className="sticky top-6 space-y-1">
            {MENU.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
