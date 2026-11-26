"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ClayIcon, { toneForSeed, type ClayIconName } from "@/app/components/mobile/ClayIcon";
import HouseLogo from "@/app/components/mobile/HouseLogo";
import LiveClock from "@/app/components/mobile/LiveClock";
import type { PublicUser } from "@/lib/db";

const MENU: { href: string; label: string; icon: ClayIconName; badge?: boolean }[] = [
  { href: "/admin", label: "داشبورد", icon: "home" },
  { href: "/admin/users", label: "مدیریت کاربران", icon: "users" },
  { href: "/admin/requests", label: "درخواست‌های اعضا", icon: "bell", badge: true },
  { href: "/bank/members", label: "اعضا", icon: "user" },
  { href: "/bank/transactions", label: "تراکنش‌ها", icon: "swap" },
  { href: "/bank/loans", label: "وام‌ها و اقساط", icon: "banknote" },
  { href: "/bank/reports", label: "گزارش‌ها", icon: "chart" },
  { href: "/bank/settings", label: "تنظیمات", icon: "settings" },
  { href: "/bank/audit", label: "سوابق", icon: "history" },
];

function faCount(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

/** نشان قرمز تعداد درخواست‌های خوانده‌نشده */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {faCount(count)}
    </span>
  );
}

/**
 * قاب پنل ادمین — هم‌سبک با پوسته «فم بانک» (پنل یوزر):
 * هدر برند با لوگوی خانه سه‌بعدی + «فم بانک» + زیرنویس انگلیسی Fam Bank +
 * نوار روز/تاریخ/ساعت زنده + چیپ «مدیر» + آواتار سفالی، منوی کناری دسکتاپ
 * و نوار افقی موبایل با آیکون‌های سه‌بعدی پاستلی.
 * منطق قبلی دست‌نخورده: گارد دسترسی، زنگ درخواست‌های خوانده‌نشده (هر ۳۰ ثانیه)، خروج.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/requests/unread");
      if (!r.ok) return;
      const d = (await r.json()) as { count?: number };
      setUnread(Number.isFinite(d.count) ? Number(d.count) : 0);
    } catch {
      // اعلان حیاتی نیست؛ خطای موقت نادیده گرفته می‌شود
    }
  }, []);

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

  // شمارش خوانده‌نشده: با ورود به پنل، با هر تغییر صفحه و هر ۳۰ ثانیه
  useEffect(() => {
    if (me?.role !== "admin") return;
    const timer = setTimeout(() => void refreshUnread(), 0);
    const interval = setInterval(() => void refreshUnread(), 30_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [me, pathname, refreshUnread]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (me === undefined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black dark:text-zinc-50">
        <span className="animate-pulse">
          <HouseLogo size={56} />
        </span>
        <p className="text-sm text-zinc-500">در حال باز کردن پنل مدیریت…</p>
      </main>
    );
  }
  if (me === null || me.role !== "admin") {
    return null; // در حال ریدایرکت
  }

  const displayName = me.fullName || me.username;
  const avatarTone = toneForSeed(me.username);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black dark:text-zinc-50">
      {/* هدر برند — هم‌سبک با هدر پوسته موبایل فم بانک؛ جلسه ۳۷: رنگ برند
          آبی آسمانی شد (به درخواست کاربر، هم لایه یوزر هم ادمین) */}
      <header
        className="sticky top-0 z-30 overflow-hidden bg-gradient-to-bl from-primary-900 via-primary-800 to-primary-700 text-white shadow-lg shadow-primary-900/30"
        data-noprint
      >
        {/* درخشش‌های تزئینی — جلسه ۳۵: radial-gradient به‌جای blur زنده (سرعت اسکرول)؛ جلسه ۳۷: پالت آبی آسمانی */}
        <div aria-hidden className="pointer-events-none absolute -top-12 left-16 size-44 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-24 size-40 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(125,211,252,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -top-8 left-1/2 size-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(186,230,253,0.15), transparent)" }} />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <HouseLogo size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-bold leading-5">فم بانک</h1>
                <span className="hidden shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-inset ring-white/25 sm:inline">
                  پنل مدیریت
                </span>
              </div>
              <p dir="ltr" className="mt-0.5 text-right text-[10px] font-medium leading-3 tracking-wide text-white/55">
                Fam Bank
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/requests"
              title="درخواست‌ها و حساب‌های واریز جدید اعضا"
              aria-label={`درخواست‌ها و حساب‌های واریز خوانده‌نشده: ${unread}`}
              className="clay-press relative grid size-9 place-items-center rounded-full bg-white/12 text-white/85 ring-1 ring-inset ring-white/20 transition hover:bg-white/20 hover:text-white"
            >
              <ClayIcon name="bell" size={26} ghost />
              {unread > 0 && (
                <>
                  <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {faCount(unread)}
                  </span>
                  <span className="absolute -left-1 -top-1 size-2.5 animate-pulse rounded-full bg-red-500" />
                </>
              )}
            </Link>
            <span className="max-w-[9rem] truncate text-xs text-white/80">{displayName}</span>
            <span
              className="clay"
              style={{ width: 38, height: 38, background: `linear-gradient(140deg, ${avatarTone[0]}, ${avatarTone[1]})` }}
            >
              <span className="relative z-10 text-xs font-bold text-white">{displayName.trim().charAt(0)}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="clay-press grid size-9 place-items-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/30 transition hover:bg-red-500/25 hover:text-red-200"
              title="خروج"
              aria-label="خروج"
            >
              <ClayIcon name="logout" size={22} ghost ghostColor="currentColor" />
            </button>
          </div>
        </div>

        {/* نوار روز/تاریخ/ساعت زنده (جلسه ۲۷) — روی زمینه آبی آسمانی با نسخه روشن */}
        <div className="relative mx-auto flex max-w-6xl justify-center px-4 pb-1.5" data-noprint>
          <LiveClock light />
        </div>

        {/* نوار افقی منو در موبایل — قرص‌های شیشه‌ای سفید روی زمینه آبی آسمانی */}
        <nav className="relative mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2.5 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MENU.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-white text-primary-800 shadow-md shadow-black/20"
                    : "border border-white/20 bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
                }`}
              >
                <ClayIcon name={item.icon} size={22} ghost ghostColor={active ? "currentColor" : "#fff"} />
                {item.label}
                {item.badge && <UnreadBadge count={unread} />}
              </Link>
            );
          })}
        </nav>
        <div className="relative h-[3px] bg-gradient-to-l from-sky-300 via-sky-400 to-primary-500" />
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        {/* منوی کناری دسکتاپ — کارت سفالی با آیکون‌های سه‌بعدی */}
        <aside className="hidden w-60 shrink-0 md:block" data-noprint>
          <nav className="sticky top-6 space-y-1 rounded-3xl border border-zinc-200/80 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {MENU.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`clay-press flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-gradient-to-l from-primary-700 to-primary-500 font-semibold text-white shadow-md shadow-primary-600/25"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  {active ? (
                    <ClayIcon name={item.icon} size={30} ghost ghostColor="#fff" />
                  ) : (
                    <ClayIcon name={item.icon} size={30} ghost ghostColor="currentColor" />
                  )}
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <UnreadBadge count={unread} />}
                </Link>
              );
            })}
            <p className="px-3 pb-1 pt-2 text-[10px] leading-5 text-zinc-400">
              پنل مدیریت فم بانک — نسخه وب
            </p>
          </nav>
        </aside>
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
