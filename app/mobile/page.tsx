"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClayIcon, { toneForSeed } from "@/app/components/mobile/ClayIcon";
import BottomNav, { type MobileTab } from "@/app/components/mobile/BottomNav";
import DashboardView, { type DashboardTab } from "@/app/components/DashboardView";
import ServicesScreen from "@/app/components/mobile/ServicesScreen";
import TransactionsScreen from "@/app/components/mobile/TransactionsScreen";
import UsersScreen from "@/app/components/mobile/UsersScreen";
import SettingsScreen from "@/app/components/mobile/SettingsScreen";
import type { NavTarget, SettingsSection } from "@/app/components/mobile/nav";
import type { PublicUser } from "@/lib/db";

/**
 * پوسته موبایل فم بانک — هدر برند + نوار ناوبری پایین
 * با ۵ آیتم (خانه، خدمات، تراکنش‌ها، مدیریت کاربران، تنظیمات).
 * تب «خانه» برای عضو = شبکه مربع‌های سر فصل‌ها؛ هر سر فصل «یک‌تیکه» و لمسش
 * مستقیم همان بخش را باز می‌کند (بدون واسط داشبورد کلی) — جلسه ۲۶ مرحله ۲.
 */

const BRAND_TONE: [string, string] = ["#6198F7", "#1A46AF"];

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
    setDashView(tab);
    setHomeKey((k) => k + 1);
    setActive("home");
  }

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
        <span className="clay" style={{ width: 56, height: 56, background: `linear-gradient(140deg, ${BRAND_TONE[0]}, ${BRAND_TONE[1]})` }}>
          <span className="relative z-10 text-sm font-black text-white">FB</span>
        </span>
        <p className="text-sm text-zinc-500">در حال باز کردن فم بانک…</p>
      </main>
    );
  }
  if (me === null) return null; // در حال ریدایرکت به لاگین

  const isAdmin = me.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black dark:text-zinc-50">
      {/* هدر برند */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="clay"
              style={{ width: 44, height: 44, background: `linear-gradient(140deg, ${BRAND_TONE[0]}, ${BRAND_TONE[1]})` }}
            >
              <span className="relative z-10 -mb-px text-[13px] font-black tracking-tight text-white">FB</span>
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold leading-5">فم بانک</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                isAdmin
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {isAdmin ? "مدیر" : "عضو"}
            </span>
            <span className="clay" style={{ width: 38, height: 38, background: `linear-gradient(140deg, ${toneForSeed(me.username)[0]}, ${toneForSeed(me.username)[1]})` }}>
              <span className="relative z-10 text-xs font-bold text-white">{(me.fullName || me.username).trim().charAt(0)}</span>
            </span>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-l from-primary-700 via-primary-500 to-primary-300" />
      </header>

      {/* محتوای تب فعال */}
      <main className="mx-auto w-full max-w-md flex-1 pb-28">
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
        {active === "users" && <UsersScreen me={me} />}
        {active === "settings" && (
          <SettingsScreen
            me={me}
            section={settingsSection}
            onSectionChange={(s: SettingsSection | null) => setSettingsSection(s)}
          />
        )}
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
            setActive(t);
          }
        }}
      />
    </div>
  );
}

/** خانه مخصوص مدیر در پوسته موبایل — خلاصه بانک از داده واقعی + میان‌برها */
function AdminMobileHome({ name }: { name: string }) {
  const [summary, setSummary] = useState<{ depositsTotal: number; loansTotal: number; members: number } | null>(null);

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

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="rounded-3xl bg-gradient-to-bl from-primary-700 via-primary-800 to-primary-950 p-5 text-white shadow-lg shadow-primary-900/30">
        <p className="text-xs text-white/70">سلام، {name}</p>
        <p className="mt-1 text-sm font-medium text-white/90">موجودی بانک</p>
        <p className="mt-1 text-2xl font-black tracking-tight">
          {cash === null ? "…" : `${fa(cash)} تومان`}
        </p>
        <div className="mt-3 flex gap-4 text-[11px] text-white/70">
          <span>واریزی‌ها: {summary ? fa(summary.depositsTotal) : "…"}</span>
          <span>تسهیلات پرداختی: {summary ? fa(summary.loansTotal) : "…"}</span>
          <span>اعضا: {summary ? fa(summary.members) : "…"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin" className="clay-press rounded-3xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="building" size={44} className="mx-auto" />
          <p className="mt-2 text-xs font-semibold">پنل مدیریت کامل</p>
        </Link>
        <Link href="/admin" className="clay-press rounded-3xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="chart" size={44} className="mx-auto" />
          <p className="mt-2 text-xs font-semibold">گزارش‌ها</p>
        </Link>
      </div>

      <p className="text-center text-[11px] leading-6 text-zinc-400">
        مدیریت اعضا، وام‌ها و تنظیمات بانک در پنل مدیریت کامل انجام می‌شود؛
        مدیریت کاربران و تراکنش‌ها از نوار پایین در دسترس است.
      </p>
    </div>
  );
}
