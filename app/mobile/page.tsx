"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClayIcon, { NAVY_TONE } from "@/app/components/mobile/ClayIcon";
import HouseLogo from "@/app/components/mobile/HouseLogo";
import LiveClock from "@/app/components/mobile/LiveClock";
import MemberBell from "@/app/components/mobile/MemberBell";
import BottomNav, { type MobileTab } from "@/app/components/mobile/BottomNav";
import DashboardView, { type DashboardTab } from "@/app/components/DashboardView";
import ServicesScreen from "@/app/components/mobile/ServicesScreen";
import TransactionsScreen from "@/app/components/mobile/TransactionsScreen";
import SettingsScreen from "@/app/components/mobile/SettingsScreen";
import type { NavTarget, SettingsSection } from "@/app/components/mobile/nav";
import { useSwipeNav } from "@/app/components/mobile/useSwipeNav";
import type { PublicUser } from "@/lib/db";

/** ترتیب تب‌های پوسته برای ناوبری کشویی و جهت انیمیشن — RTL: راست = بعدی (جلسه ۳۹) */
const TAB_ORDER: MobileTab[] = ["home", "services", "transactions", "settings"];

/**
 * پوسته موبایل فم بانک — هدر برند (لوگوی خانه سه‌بعدی + فم بانک + Fam Bank
 * + روز/تاریخ/ساعت زنده) + نوار ناوبری پایین با ۴ آیتم
 * (خانه، خدمات، تراکنش‌ها، تنظیمات) — «مدیریت کاربران» از لایه یوزر حذف شد
 * (جلسه ۲۷) و مدیریت کاربران فقط در پنل ادمین است.
 * تب «خانه» برای عضو = شبکه مربع‌های سر فصل‌ها؛ هر سر فصل «یک‌تیکه» و لمسش
 * مستقیم همان بخش را باز می‌کند (بدون واسط داشبورد کلی) — جلسه ۲۶ مرحله ۲.
 * جلسه ۳۷: زنگوله اعلان‌های عضو در هدر + رنگ برند آبی آسمانی (به‌جای فیروزه‌ای)
 * + آواتار پروفایل هم‌رنگ آیکون سورمه‌ای.
 */

export default function MobileAppPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);
  const [active, setActive] = useState<MobileTab>("home");
  /** نمای خانه عضو: "tiles" = مربع‌های سر فصل‌ها؛ بقیه = بخش باز با دکمه بازگشت */
  const [dashView, setDashView] = useState<DashboardTab>("tiles");
  /** کلید remount داشبورد برای refresh داده بعد از پرش از خدمات/تراکنش‌ها */
  const [homeKey, setHomeKey] = useState(0);
  /** بخش باز تنظیمات (وقتی از خدمات به تنظیمات پرش می‌شود) */
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  /** جهت آخرین جابه‌جایی صفحه برای انیمیشن ورود کشویی (جلسه ۳۹) */
  const [navDir, setNavDir] = useState<"next" | "prev">("next");

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: PublicUser | null }) => {
        if (!alive) return;
        setMe(d.user ?? null);
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
  }, [me, router]);

  /** باز کردن مستقیم یک سر فصل داشبورد (از خدمات/اکشن‌های سریع) — یک‌تیکه */
  function goHomeTab(tab: DashboardTab) {
    if (active !== "home") setNavDir("prev"); // خانه در RTL اولین صفحه است (از راست وارد می‌شود)
    setDashView(tab);
    setHomeKey((k) => k + 1);
    setActive("home");
  }

  /** تغییر تب پوسته با جهت انیمیشن کشویی — ترتیب RTL (جلسه ۳۹) */
  function goTab(t: MobileTab) {
    if (t === active) return;
    setNavDir(TAB_ORDER.indexOf(t) >= TAB_ORDER.indexOf(active) ? "next" : "prev");
    setActive(t);
  }

  /** سوایپ افقی بین تب‌های پوسته — RTL: کشیدن به راست = بعدی (جلسه ۳۹) */
  function stepShell(delta: 1 | -1) {
    const next = TAB_ORDER[TAB_ORDER.indexOf(active) + delta];
    if (!next) return;
    if (next === "home" && !isAdmin) {
      goHomeTab("tiles"); // خانه عضو همیشه از مربع‌های سر فصل‌ها شروع می‌شود
    } else {
      setNavDir(delta === 1 ? "next" : "prev");
      setActive(next);
    }
  }

  const swipe = useSwipeNav({
    onSwipeNext: () => stepShell(1),
    onSwipePrev: () => stepShell(-1),
  });

  /** قرارداد ناوبری مشترک همه اسلایدها */
  function navigate(target: NavTarget) {
    if (target.tab === "home") {
      goHomeTab(target.dashboardTab ?? "tiles");
      return;
    }
    if (target.tab === "settings") {
      setSettingsSection(target.section ?? null);
    }
    setActive(target.tab);
  }

  if (me === undefined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <span className="animate-pulse">
          <HouseLogo size={56} />
        </span>
        <p className="text-sm text-zinc-500">در حال باز کردن فم بانک…</p>
      </main>
    );
  }
  if (me === null) return null; // در حال ریدایرکت به لاگین

  const isAdmin = me.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black dark:text-zinc-50">
      {/* هدر برند — آبی آسمانی برند (جلسه ۳۷ به درخواست کاربر: «رنگ آبی فیروزه‌ای رو
          به رنگ آبی آسمانی تغییر بده») با درخشش آبی هماهنگ با لوگو (جلسه ۳۲):
          لوگوی خانه سه‌بعدی + فم بانک + Fam Bank + روز/تاریخ/ساعت زنده + زنگوله
          اعلان‌های عضو (جلسه ۳۷). نشان نقش فقط برای «مدیر» نمایش داده می‌شود. */}
      <header className="sticky top-0 z-30 overflow-hidden bg-gradient-to-bl from-primary-900 via-primary-800 to-primary-700 text-white shadow-lg shadow-primary-900/30">
        {/* درخشش‌های تزئینی — جلسه ۳۵: radial-gradient به‌جای blur زنده؛ جلسه ۳۷: پالت آبی آسمانی */}
        <div aria-hidden className="pointer-events-none absolute -top-12 left-2 size-44 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-8 size-40 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(125,211,252,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -top-8 right-1/3 size-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(186,230,253,0.15), transparent)" }} />
        <div className="relative mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <HouseLogo size={44} />
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold leading-5">فم بانک</h1>
              <p dir="ltr" className="mt-0.5 text-right text-[10px] font-medium leading-3 tracking-wide text-white/55">
                Fam Bank
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAdmin && <MemberBell />}
            {isAdmin && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white ring-1 ring-inset ring-white/25">
                مدیر
              </span>
            )}
            {/* جلسه ۳۷: آواتار پروفایل هم‌رنگ آیکون سورمه‌ای (به درخواست کاربر) */}
            <span
              className="clay"
              style={{ width: 38, height: 38, background: `linear-gradient(140deg, ${NAVY_TONE[0]}, ${NAVY_TONE[1]})` }}
            >
              <span className="relative z-10 text-xs font-bold text-white">{(me.fullName || me.username).trim().charAt(0)}</span>
            </span>
          </div>
        </div>
        {/* روز، تاریخ و ساعت زنده (جلسه ۲۷) */}
        <div className="relative mx-auto flex max-w-md justify-center px-4 pb-2">
          <LiveClock light />
        </div>
        <div className="relative h-[3px] bg-gradient-to-l from-sky-300 via-sky-400 to-primary-500" />
      </header>

      {/* محتوای تب فعال — سوایپ افقی هم تب‌ها را عوض می‌کند (جلسه ۳۹)؛ هر تب با
          کلید خودش remount می‌شود تا انیمیشن ورود کشویی پخش شود */}
      <main className="mx-auto w-full max-w-md flex-1 pb-28" {...swipe}>
        <div key={active} className={navDir === "prev" ? "page-in-prev" : "page-in-next"}>
          {active === "home" &&
            (isAdmin ? (
              <AdminMobileHome name={me.fullName || me.username} />
            ) : (
              <DashboardView
                key={homeKey}
                embedded
                initialTab={dashView}
                onBack={() => setDashView("tiles")}
                onTabChange={setDashView}
              />
            ))}

          {active === "services" && <ServicesScreen me={me} onNavigate={navigate} />}
          {active === "transactions" && <TransactionsScreen me={me} onNavigate={navigate} />}
          {active === "settings" && (
            <SettingsScreen
              me={me}
              section={settingsSection}
              onSectionChange={(s: SettingsSection | null) => setSettingsSection(s)}
            />
          )}
        </div>
      </main>

      <BottomNav
        active={active}
        onChange={(t) => {
          // لمس «خانه» همیشه به مربع‌های سر فصل‌ها برمی‌گردد (حتی وسط یک بخش)؛
          // اگر همین حالا آنجاییم remount لازم نیست
          if (t === "home" && !isAdmin) {
            if (active === "home" && dashView === "tiles") return;
            goHomeTab("tiles");
          } else {
            goTab(t);
          }
        }}
      />
    </div>
  );
}

/**
 * خانه مخصوص مدیر در پوسته موبایل — هیرو موجودی بانک + مربع‌های سه‌بعدی که
 * هیچ عددی روی خودشان ندارند و اطلاعات هر مربع فقط بعد از لمس دیده می‌شود
 * (جلسه ۲۶ مرحله ۵)؛ دو مربع آخر میان‌بر ناوبری‌اند.
 */
function AdminMobileHome({ name }: { name: string }) {
  const [summary, setSummary] = useState<{ depositsTotal: number; loansTotal: number; members: number } | null>(null);
  /** مربع لمس‌شده — جزئیاتش در کارت زیر شبکه مربع‌ها دیده می‌شود */
  const [openTile, setOpenTile] = useState<"deposits" | "loans" | "members" | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/bank/deposits").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/bank/loans").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([d, l, m]) => {
        if (!alive) return;
        const deposits = Array.isArray(d) ? d : [];
        const loans = Array.isArray(l) ? l : [];
        const members = Array.isArray(m) ? m : [];
        setSummary({
          depositsTotal: deposits.reduce((s: number, x: { amount: number }) => s + (Number(x.amount) || 0), 0),
          loansTotal: loans.reduce((s: number, x: { disbursedAmount: number }) => s + (Number(x.disbursedAmount) || 0), 0),
          members: members.length,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fa = (v: number) => Number(v || 0).toLocaleString("fa-IR");
  const cash = summary ? summary.depositsTotal - summary.loansTotal : null;

  /** جزئیات مربع آماری لمس‌شده */
  const detail: { title: string; icon: "deposit" | "banknote" | "users"; value: number; suffix: string; subtitle: string } | null =
    (() => {
      if (!openTile || !summary) return null;
      if (openTile === "deposits")
        return {
          title: "جمع واریزی‌ها",
          icon: "deposit",
          value: summary.depositsTotal,
          suffix: "تومان",
          subtitle: "جمع همه واریزی‌های اعضا تا امروز",
        };
      if (openTile === "loans")
        return {
          title: "تسهیلات پرداختی",
          icon: "banknote",
          value: summary.loansTotal,
          suffix: "تومان",
          subtitle: "جمع مبلغ پرداخت‌شده تسهیلات به اعضا",
        };
      return {
        title: "اعضا",
        icon: "users",
        value: summary.members,
        suffix: "نفر",
        subtitle: "تعداد اعضای ثبت‌شده در بانک",
      };
    })();

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary-600 via-primary-700 to-primary-900 p-5 text-white shadow-lg shadow-primary-800/30">
        <div aria-hidden className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.2), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 right-4 size-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(186,230,253,0.15), transparent)" }} />
        <p className="relative text-xs text-white/70">سلام، {name}</p>
        <p className="relative mt-1 text-sm font-medium text-white/90">موجودی بانک</p>
        <p className="relative mt-1 text-2xl font-black tracking-tight">
          {cash === null ? "…" : `${fa(cash)} تومان`}
        </p>
      </div>

      {/* مربع‌های سه‌بعدی خانه مدیر — بدون عدد؛ اطلاعات هر مربع فقط با لمس آن؛
          جلسه ۳۲: تینت پاستلی هماهنگ با رنگ آیکون هر مربع */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setOpenTile((cur) => (cur === "deposits" ? null : "deposits"))}
          aria-pressed={openTile === "deposits"}
          style={{ backgroundImage: "linear-gradient(145deg, #FFD98E33 0%, #F0A32B1a 55%, transparent 100%)" }}
          className={`clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 ${
            openTile === "deposits"
              ? "border-primary-400 bg-primary-50/70 ring-2 ring-primary-500/60 dark:border-primary-600 dark:bg-primary-950/50"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <ClayIcon name="deposit" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">جمع واریزی‌ها</span>
        </button>
        <button
          type="button"
          onClick={() => setOpenTile((cur) => (cur === "loans" ? null : "loans"))}
          aria-pressed={openTile === "loans"}
          style={{ backgroundImage: "linear-gradient(145deg, #FFB3C633 0%, #E85E8A1a 55%, transparent 100%)" }}
          className={`clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 ${
            openTile === "loans"
              ? "border-primary-400 bg-primary-50/70 ring-2 ring-primary-500/60 dark:border-primary-600 dark:bg-primary-950/50"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <ClayIcon name="banknote" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">تسهیلات پرداختی</span>
        </button>
        <button
          type="button"
          onClick={() => setOpenTile((cur) => (cur === "members" ? null : "members"))}
          aria-pressed={openTile === "members"}
          style={{ backgroundImage: "linear-gradient(145deg, #C3AEF533 0%, #8460D61a 55%, transparent 100%)" }}
          className={`clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 ${
            openTile === "members"
              ? "border-primary-400 bg-primary-50/70 ring-2 ring-primary-500/60 dark:border-primary-600 dark:bg-primary-950/50"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <ClayIcon name="users" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">اعضا</span>
        </button>
        <Link
          href="/admin"
          style={{ backgroundImage: "linear-gradient(145deg, #B9C4E833 0%, #6878B81a 55%, transparent 100%)" }}
          className="clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <ClayIcon name="building" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">پنل مدیریت کامل</span>
        </Link>
        <Link
          href="/bank/reports"
          style={{ backgroundImage: "linear-gradient(145deg, #8FE0DC33 0%, #2FA8A21a 55%, transparent 100%)" }}
          className="clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <ClayIcon name="chart" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">گزارش‌ها</span>
        </Link>
      </div>
      <p className="text-center text-[11px] leading-6 text-zinc-400">
        برای دیدن اطلاعات هر مربع، آن را لمس کنید.
      </p>

      {/* کارت جزئیات — فقط بعد از لمس مربع آماری */}
      {detail && (
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <ClayIcon name={detail.icon} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{detail.title}</p>
                <p className="mt-1 text-xl font-bold text-primary-700 dark:text-primary-300">
                  {fa(detail.value)}
                  <span className="mr-1 text-xs font-normal opacity-70">{detail.suffix}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenTile(null)}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              بستن
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{detail.subtitle}</p>
        </div>
      )}

      <p className="text-center text-[11px] leading-6 text-zinc-400">
        مدیریت اعضا، وام‌ها و تنظیمات بانک در پنل مدیریت کامل انجام می‌شود؛
        تراکنش‌ها هم از نوار پایین در دسترس است.
      </p>
    </div>
  );
}
