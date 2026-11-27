"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClayIcon from "@/app/components/mobile/ClayIcon";
import HouseLogo from "@/app/components/mobile/HouseLogo";
import LiveClock from "@/app/components/mobile/LiveClock";
import MemberBell from "@/app/components/mobile/MemberBell";
import { useBackGuardRoot, useBackHandler } from "@/app/components/mobile/backGuard";
import BottomNav, { type MobileTab } from "@/app/components/mobile/BottomNav";
import DashboardView, { type DashboardTab } from "@/app/components/DashboardView";
import ServicesScreen from "@/app/components/mobile/ServicesScreen";
import TransactionsScreen from "@/app/components/mobile/TransactionsScreen";
import type { NavTarget, SettingsSection } from "@/app/components/mobile/nav";
import { useSwipeNav } from "@/app/components/mobile/useSwipeNav";
import { jalaliParts } from "@/lib/bank";
import { isWithdrawType } from "@/lib/deposit-types";
import type { BankDeposit, PublicUser } from "@/lib/db";

/** ترتیب تب‌های پوسته برای ناوبری کشویی و جهت انیمیشن — RTL: راست = بعدی (جلسه ۳۹)
 *  جلسه ۵۲: ۳ تب به ترتیب درخواست کاربر — خانه، تراکنش‌ها، خدمات (تنظیمات حذف شد) */
const TAB_ORDER: MobileTab[] = ["home", "transactions", "services"];

/** جلسه ۵۳ — نوع پرش مستقیم به فرم پرداخت از اکشن‌های سریع تراکنش‌ها */
type OpenPaymentKind = "share" | "installment";

/** جلسه ۵۴ — یک «مرحله» داخلی اپ برای دکمهٔ برگشت گوشی (backGuard):
 *  برگشت به‌جای خروج از برنامه، مرحلهٔ قبلی (تب/بخش قبلی) را باز می‌گرداند */
type ShellSnapshot = {
  active: MobileTab;
  dashView: DashboardTab;
  serviceSection: SettingsSection | null;
};

/**
 * پوسته موبایل فَم بانک — هدر برند (لوگوی خانه سه‌بعدی + فَم بانک + Fam Bank
 * + روز/تاریخ/ساعت زنده) + نوار ناوبری پایین با ۳ آیتم به ترتیب
 * (خانه، تراکنش‌ها، خدمات) — جلسه ۵۲: تب «تنظیمات» حذف شد و همهٔ آیتم‌هایش
 * مربع‌های گرید «خدمات» شدند؛ «مدیریت کاربران» از لایه یوزر حذف شد
 * (جلسه ۲۷) و مدیریت کاربران فقط در پنل ادمین است.
 * جلسه ۵۷ (به درخواست کاربر، اصلاح درخواست جلسه ۵۶): نوار ناوبری پایین در
 * همهٔ تب‌ها برگشت و در عوض در لایه یوزرِ تب «تراکنش‌ها» نوار بالای ثابت
 * (هدر برند + ساعت زنده) حذف می‌شود — فقط همان تب و فقط برای عضو
 * (مدیر هدر را در همهٔ تب‌ها دارد؛ برگشت به هدر با خروج از همان تب).
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
  /** جلسه ۵۳ — پرش مستقیم به فرم پرداخت (سهام/قسط) از اکشن‌های سریع تراکنش‌ها؛
   *  فقط همراه dashView معنادار است و هر goHomeTab دوباره مقدارش را می‌گذارد */
  const [homeOpenPayment, setHomeOpenPayment] = useState<OpenPaymentKind | undefined>(undefined);
  /** کلید remount داشبورد برای refresh داده بعد از پرش از خدمات/تراکنش‌ها */
  const [homeKey, setHomeKey] = useState(0);
  /** بخش باز خدمات (وقتی از پرش ناوبری یا مربع خدمات به جزئیات می‌رویم) */
  const [serviceSection, setServiceSection] = useState<SettingsSection | null>(null);
  /** جهت آخرین جابه‌جایی صفحه برای انیمیشن ورود کشویی (جلسه ۳۹) */
  const [navDir, setNavDir] = useState<"next" | "prev">("next");
  /** جلسه ۵۴ — پشتهٔ مراحل قبلی ناوبری داخلی برای دکمهٔ برگشت گوشی */
  const [snapshots, setSnapshots] = useState<ShellSnapshot[]>([]);
  /** جلسه ۵۴ — هشدار «برای خروج دوباره برگشت را بزنید» در ریشهٔ اپ */
  const [exitHint, setExitHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** نقش کاربر — قبل از اولین render معلوم نیست؛ false موقتی است */
  const isAdmin = me?.role === "admin";

  /** جلسه ۵۷ (به درخواست کاربر، اصلاح جلسه ۵۶): نوار پایین در همهٔ تب‌ها
   *  برگشت و در عوض در لایه یوزرِ تب «تراکنش‌ها» نوار بالای ثابت (هدر برند +
   *  ساعت + زنگوله) حذف می‌شود — فقط همان تب و فقط برای عضو؛ مدیر هدر را
   *  در همهٔ تب‌ها دارد. برگشت به هدر با خروج از همان تب (نوار پایین، دکمهٔ
   *  برگشت گوشی یا کشیدن انگشت) */
  const hideHeader = !isAdmin && active === "transactions";

  /** جلسه ۵۴ — ریشهٔ گارد برگشت: نشانگر history + رویداد popstate؛
 *  در ریشه (هیچ مرحلهٔ قبلی نبود) فقط هشدار خروج می‌آید و خروج واقعی
   *  با زدن دوبارهٔ برگشت آزاد می‌شود */
  useBackGuardRoot((show) => {
    setExitHint(show);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    if (show) hintTimer.current = setTimeout(() => setExitHint(false), 2200);
  });

  /** ثبت «مرحلهٔ» فعلی در پشته — قبل از هر جابه‌جایی داخلی صدا می‌شود؛
   *  مرحلهٔ تکراریِ پشت سر هم دوبار ثبت نمی‌شود */
  function pushSnapshot() {
    const cur: ShellSnapshot = { active, dashView, serviceSection };
    setSnapshots((s) => {
      const last = s[s.length - 1];
      if (last && last.active === cur.active && last.dashView === cur.dashView && last.serviceSection === cur.serviceSection) {
        return s;
      }
      return [...s.slice(-29), cur];
    });
  }

  /** جلسه ۵۴ — دکمهٔ برگشت گوشی وقتی هیچ لایهٔ مودالی باز نیست:
   *  مرحلهٔ قبلی ناوبری داخلی (تب/بخش/جزئیات خدمات) بازگردانده می‌شود */
  useBackHandler(() => {
    if (snapshots.length === 0) return false;
    const prev = snapshots[snapshots.length - 1];
    setSnapshots((all) => all.slice(0, -1));
    setNavDir("prev");
    if (prev.active === "home" && !isAdmin) {
      // بازگرداندن بخش قبلی داشبورد بدون remount (سینک initialTab);
      // پرش خودکار پرداخت در حالت برگشت معنا ندارد
      setHomeOpenPayment(undefined);
      setDashView(prev.dashView);
      setActive("home");
    } else {
      if (prev.active === "services") setServiceSection(prev.serviceSection);
      setActive(prev.active);
    }
    return true;
  }, 0);

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

  /** باز کردن مستقیم یک سر فصل داشبورد (از خدمات/اکشن‌های سریع) — یک‌تیکه.
   *  جلسه ۵۳: openPayment = بعد از لود داده، فرم پرداخت همان نوع برای اولین
   *  پرداخت در دسترس خودکار باز می‌شود (موجودی برای بازگشت به مربع‌ها پاک می‌شود) */
  function goHomeTab(tab: DashboardTab, openPayment?: OpenPaymentKind) {
    if (active !== "home") setNavDir("prev"); // خانه در RTL اولین صفحه است (از راست وارد می‌شود)
    pushSnapshot(); // جلسه ۵۴ — برگشت گوشی به همین مرحله برمی‌گردد
    setDashView(tab);
    setHomeOpenPayment(openPayment);
    setHomeKey((k) => k + 1);
    setActive("home");
  }

  /** تغییر تب پوسته با جهت انیمیشن کشویی — ترتیب RTL (جلسه ۳۹) */
  function goTab(t: MobileTab) {
    if (t === active) return;
    pushSnapshot(); // جلسه ۵۴
    setNavDir(TAB_ORDER.indexOf(t) >= TAB_ORDER.indexOf(active) ? "next" : "prev");
    setActive(t);
  }

  /** سوایپ افقی بین تب‌های پوسته — RTL: کشیدن به راست = بعدی (جلسه ۳۹) */
  function stepShell(delta: 1 | -1) {
    const next = TAB_ORDER[TAB_ORDER.indexOf(active) + delta];
    if (!next) return;
    pushSnapshot(); // جلسه ۵۴
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
      goHomeTab(target.dashboardTab ?? "tiles", target.openPayment);
      return;
    }
    if (target.tab === "services") {
      pushSnapshot(); // جلسه ۵۴ — برگشت گوشی به مرحلهٔ قبل برمی‌گردد
      setServiceSection(target.section ?? null);
    }
    setActive(target.tab);
  }

  if (me === undefined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <span className="animate-pulse">
          <HouseLogo size={56} />
        </span>
        <p className="text-sm text-zinc-500">در حال باز کردن فَم بانک…</p>
      </main>
    );
  }
  if (me === null) return null; // در حال ریدایرکت به لاگین

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black dark:text-zinc-50">
      {/* هدر برند — آبی آسمانی برند (جلسه ۳۷ به درخواست کاربر: «رنگ آبی فیروزه‌ای رو
          به رنگ آبی آسمانی تغییر بده») با درخشش آبی هماهنگ با لوگو (جلسه ۳۲):
          لوگوی خانه سه‌بعدی + فَم بانک + Fam Bank + روز/تاریخ/ساعت زنده + زنگوله
          اعلان‌های عضو (جلسه ۳۷). نشان نقش فقط برای «مدیر» نمایش داده می‌شود.
          جلسه ۵۷ (به درخواست کاربر): این نوار بالا فقط در تب «تراکنش‌ها» لایه
          یوزر حذف می‌شود (hideHeader) — در بقیهٔ تب‌ها و برای مدیر هست. */}
      {!hideHeader && (
      <header className="sticky top-0 z-30 overflow-hidden bg-gradient-to-bl from-primary-700 via-primary-600 to-primary-500 text-white shadow-lg shadow-primary-800/30">
        {/* درخشش‌های تزئینی — جلسه ۳۵: radial-gradient به‌جای blur زنده؛ جلسه ۳۷: پالت آبی آسمانی */}
        <div aria-hidden className="pointer-events-none absolute -top-12 left-2 size-44 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-8 size-40 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(125,211,252,0.25), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute -top-8 right-1/3 size-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(186,230,253,0.15), transparent)" }} />
        {/* جلسه ۴۸: فاصله عمودی ردیف اصلی هدر بیشتر شد تا فشردگی کمتر باشد */}
        <div className="relative mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <HouseLogo size={44} />
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold leading-5">فَم بانک</h1>
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
            {/* جلسه ۴۱: آواتار پروفایل دقیقاً هم‌رنگ زمینهٔ لوگو شد (سمت راست
                هدر) — همان گرادیان سرمه‌ایِ پس‌زمینهٔ HouseLogo
                (#212F5A→#0F1B3D) — به درخواست کاربر */}
            <span
              className="clay"
              style={{ width: 38, height: 38, background: "linear-gradient(140deg, #212F5A 0%, #0F1B3D 78%)" }}
            >
              <span className="relative z-10 text-xs font-bold text-white">{(me.fullName || me.username).trim().charAt(0)}</span>
            </span>
          </div>
        </div>
        {/* روز، تاریخ و ساعت زنده (جلسه ۲۷) — جلسه ۵۴: فاصلهٔ پایینی باز هم کمتر
            شد (pb-2.5 → pb-1.5) تا خط جداکنندهٔ پایین هدر ثابتِ لایه یوزر بالاتر
            بنشیند (دومین درخواستِ بالاتر رفتن؛ جلسه ۴۸ آن را پایین برده بود) */}
        <div className="relative mx-auto flex max-w-md justify-center px-4 pb-1.5">
          <LiveClock light />
        </div>
        <div className="relative h-[3px] bg-gradient-to-l from-sky-200 via-sky-300 to-primary-500" />
      </header>
      )}

      {/* محتوای تب فعال — سوایپ افقی هم تب‌ها را عوض می‌کند (جلسه ۳۹)؛ هر تب با
          کلید خودش remount می‌شود تا انیمیشن ورود کشویی پخش شود. جلسه ۵۷:
          نوار پایین در همهٔ تب‌ها هست (برگشت طبق درخواست کاربر) — pb-28 برمی‌گردد */}
      <main className="mx-auto w-full max-w-md flex-1 pb-28" {...swipe}>
        <div key={active} className={navDir === "prev" ? "page-in-prev" : "page-in-next"}>
          {active === "home" &&
            (isAdmin ? (
              <AdminMobileHome />
            ) : (
              <DashboardView
                key={homeKey}
                embedded
                initialTab={dashView}
                initialOpenPayment={homeOpenPayment}
                onBack={() => {
                  pushSnapshot(); // جلسه ۵۴ — دکمهٔ بازگشت UI هم مرحله را ثبت می‌کند
                  setDashView("tiles");
                }}
                onTabChange={(t: DashboardTab) => {
                  pushSnapshot(); // جلسه ۵۴ — سوایپ/لمس بخش داخل داشبورد هم مرحله است
                  setDashView(t);
                }}
              />
            ))}

          {active === "transactions" && <TransactionsScreen me={me} onNavigate={navigate} />}
          {active === "services" && (
            <ServicesScreen
              me={me}
              section={serviceSection}
              onSectionChange={(s: SettingsSection | null) => {
                pushSnapshot(); // جلسه ۵۴ — ورود/خروج جزئیات خدمات هم مرحله است
                setServiceSection(s);
              }}
            />
          )}
        </div>
      </main>

      {/* جلسه ۵۷: نوار ناوبری پایین طبق درخواست کاربر در همهٔ تب‌ها برگشت —
          حذف نوار بالا فقط مخصوص تب تراکنش‌های لایه یوزر بود */}
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

      {/* جلسه ۵۴ — هشدار خروج با دکمهٔ برگشت گوشی در ریشهٔ اپ: خروج واقعی = دوباره زدن */}
      {exitHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md justify-center px-6">
          <p className="rounded-full bg-zinc-900/90 px-5 py-2.5 text-center text-[11px] font-medium text-white shadow-lg dark:bg-zinc-800/95">
            برای خروج از فَم بانک، دوباره دکمهٔ برگشت را بزنید
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * خانه مخصوص مدیر در پوسته موبایل — هیرو موجودی بانک + مربع‌های سه‌بعدی که
 * هیچ عددی روی خودشان ندارند و اطلاعات هر مربع فقط بعد از لمس دیده می‌شود
 * (جلسه ۲۶ مرحله ۵)؛ دو مربع میان‌بر ناوبری‌اند.
 * جلسه ۵۹ (به درخواست کاربر): مربع ششم «تراکنش متفرقه» اضافه شد — فهرست
 * تراکنش‌های متفرقهٔ بانک (واریز سبز / برداشت قرمز + جمع هر کدام) زیر شبکه
 * مربع‌ها باز می‌شود؛ دکمهٔ برگشت گوشی پنل را می‌بندد.
 * جلسه ۶۲ (به درخواست کاربر): پنل متفرقه از اول روی خانهٔ مدیر باز است —
 * تراکنش‌های متفرقه بدون لمس هیچ مربعی روی خودِ خانه دیده می‌شوند؛ مربع
 * «تراکنش متفرقه» حالا فقط پنل را جمع/باز می‌کند.
 */

/** انواع «متفرقه» برای مربع خانهٔ مدیر — همان خانوادهٔ بخش متفرقهٔ یوزر:
 *  همهٔ تراکنش‌های دفتری مدیر + سود خودکار وام */
const ADMIN_MISC_TYPES = new Set([
  "misc",
  "profit",
  "loan_interest",
  "withdraw_misc",
  "installment",
  "withdraw_share",
  "withdraw_installment",
  "withdraw_profit",
]);

const ADMIN_MISC_TYPE_LABELS: Record<string, string> = {
  misc: "واریز متفرقه",
  profit: "تقسیم سود",
  loan_interest: "سود بانک",
  installment: "پرداخت قسط",
  withdraw_misc: "برداشت متفرقه",
  withdraw_share: "برداشت سهام",
  withdraw_installment: "برداشت قسط",
  withdraw_profit: "برداشت سود بانک",
  share: "پرداخت سهام",
};

/** جلسه ۶۰ — فلش ↑ سبز واریز و ↓ قرمز برداشت برای «آخرین تراکنش‌ها» خانهٔ مدیر
 *  (طبق طراحی PDF کاربر) */
function TxArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      {up ? <path d="M12 19V5" /> : <path d="M12 5v14" />}
      {up ? <path d="M5 12l7-7 7 7" /> : <path d="M19 12l-7 7-7-7" />}
    </svg>
  );
}

function AdminMobileHome() {
  const [summary, setSummary] = useState<{ depositsTotal: number; loansTotal: number; members: number } | null>(null);
  /** جلسه ۵۹ — همهٔ واریزی‌ها برای فهرست تراکنش‌های متفرقهٔ مربع ششم */
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  /** مربع لمس‌شده — جزئیاتش در کارت زیر شبکه مربع‌ها دیده می‌شود */
  const [openTile, setOpenTile] = useState<"deposits" | "loans" | "members" | null>(null);
  /** جلسه ۵۹ — پنل تراکنش‌های متفرقهٔ مربع «تراکنش متفرقه»؛ جلسه ۶۲: پیش‌فرض
   *  باز است تا تراکنش‌های متفرقه روی خودِ خانهٔ مدیر دیده شوند — مربع فقط
   *  جمع/باز می‌کند و دکمهٔ برگشت گوشی آن را می‌بندد */
  const [miscOpen, setMiscOpen] = useState(true);

  /** جلسه ۵۴/۵۹ — دکمهٔ برگشت گوشی کارت جزئیات مربع یا پنل متفرقه را می‌بندد */
  useBackHandler(() => {
    if (miscOpen) {
      setMiscOpen(false);
      return true;
    }
    if (openTile) {
      setOpenTile(null);
      return true;
    }
    return false;
  }, 1);

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
        setDeposits(deposits);
        setSummary({
          // جلسه ۵۸/۵۹ — برداشت‌ها (همهٔ انواع withdraw_*) از جمع واریزی‌ها کسر
          // می‌شوند (مبلغ رکورد برداشت با علامت منفی جمع می‌شود) تا «موجودی بانک»
          // واقعی بماند
          depositsTotal: deposits.reduce(
            (s: number, x: { amount: number; type?: string }) =>
              s +
              (isWithdrawType((x.type || "misc") as BankDeposit["type"])
                ? -(Number(x.amount) || 0)
                : Number(x.amount) || 0),
            0,
          ),
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
  /** جلسه ۶۰ — کارت‌های آماری خانهٔ مدیر: کل واریزی‌ها = جمع مبلغ همهٔ رکوردها
   *  (همه با مبلغ مثبت ذخیره می‌شوند؛ برداشت‌ها با نوع withdraw_* که در موجودی
   *  منتفی حساب می‌شوند) */
  const grossDeposits = useMemo(
    () => deposits.reduce((s: number, d: { amount: number }) => s + (Number(d.amount) || 0), 0),
    [deposits],
  );
  /** جلسه ۶۰ — آخرین تراکنش‌ها برای پنل خانهٔ مدیر (۴ مورد آخر، همهٔ انواع) */
  const lastTx = useMemo(
    () =>
      [...deposits]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 4),
    [deposits],
  );

  /** جلسه ۵۹ — ردیف‌های تراکنش متفرقهٔ بانک (همهٔ اعضا + بدون عضو) */
  const miscRows = useMemo(
    () =>
      deposits
        .filter((d) => ADMIN_MISC_TYPES.has(d.type))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [deposits],
  );
  const miscTotals = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    miscRows.forEach((d) => {
      if (isWithdrawType(d.type)) outSum += Number(d.amount) || 0;
      else inSum += Number(d.amount) || 0;
    });
    return { inSum, outSum };
  }, [miscRows]);

  const faDate = (iso: string): string => {
    try {
      const p = jalaliParts(new Date(iso));
      return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
    } catch {
      return "—";
    }
  };

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
          subtitle: "جمع خالص واریزی‌های اعضا تا امروز (پس از کسر برداشت‌های متفرقه)",
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
      {/* جلسه ۶۰ — هیرو خوش‌آمدگویی مدیر با تصویر سه‌بعدی طبق طراحی PDF
          («سلام مدیر عزیز / به سامانه صندوق خانوادگی خوش آمدید») + موجودی بانک */}
      <div className="relative overflow-hidden rounded-3xl shadow-md shadow-primary-900/20">
        <img src="/hero-banner.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-primary-950/80 via-primary-900/35 to-transparent" />
        <div className="relative px-4 py-6 text-white">
          <p className="text-base font-bold drop-shadow-sm">سلام مدیر عزیز</p>
          <p className="mt-1 text-[11px] text-white/85">به سامانه صندوق خانوادگی خوش آمدید</p>
          <p className="mt-3 text-[11px] text-white/80">موجودی بانک</p>
          <p className="mt-0.5 text-xl font-black tracking-tight drop-shadow-sm">
            {cash === null ? "…" : `${fa(cash)} تومان`}
          </p>
        </div>
      </div>

      {/* جلسه ۶۰ — چهار کارت آماری خانهٔ مدیر طبق PDF: تعداد اعضا / موجودی کل
          صندوق / کل واریزی‌ها / کل تسهیلات پرداختی، با آیکون رنگی */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-3 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <ClayIcon name="users" size={30} />
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">تعداد اعضا</p>
          </div>
          <p className="mt-2 text-sm font-black text-zinc-800 dark:text-zinc-100">
            {summary ? fa(summary.members) : "…"}
            <span className="mr-1 text-[10px] font-normal text-zinc-400">نفر</span>
          </p>
        </div>
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-3 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <ClayIcon name="wallet" size={30} />
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">موجودی کل صندوق</p>
          </div>
          <p className="mt-2 text-sm font-black text-zinc-800 dark:text-zinc-100">
            {cash === null ? "…" : fa(cash)}
            <span className="mr-1 text-[10px] font-normal text-zinc-400">تومان</span>
          </p>
        </div>
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-3 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <ClayIcon name="deposit" size={30} />
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">کل واریزی‌ها</p>
          </div>
          <p className="mt-2 text-sm font-black text-zinc-800 dark:text-zinc-100">
            {summary ? fa(grossDeposits) : "…"}
            <span className="mr-1 text-[10px] font-normal text-zinc-400">تومان</span>
          </p>
        </div>
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-3 shadow-md shadow-primary-900/5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <ClayIcon name="banknote" size={30} />
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">کل تسهیلات پرداختی</p>
          </div>
          <p className="mt-2 text-sm font-black text-zinc-800 dark:text-zinc-100">
            {summary ? fa(summary.loansTotal) : "…"}
            <span className="mr-1 text-[10px] font-normal text-zinc-400">تومان</span>
          </p>
        </div>
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
        <button
          type="button"
          onClick={() => setMiscOpen((v) => !v)}
          aria-pressed={miscOpen}
          style={{ backgroundImage: "linear-gradient(145deg, #B5EBA533 0%, #54B8541a 55%, transparent 100%)" }}
          className={`clay-press flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border p-2 shadow-md shadow-primary-900/5 transition hover:opacity-90 ${
            miscOpen
              ? "border-primary-400 bg-primary-50/70 ring-2 ring-primary-500/60 dark:border-primary-600 dark:bg-primary-950/50"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <ClayIcon name="swap" size={44} />
          <span className="text-center text-[11px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">تراکنش متفرقه</span>
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

      {/* جلسه ۵۹ — پنل تراکنش‌های متفرقهٔ مربع «تراکنش متفرقه»: جمع واریز/برداشت
          + فهرست همهٔ تراکنش‌های متفرقهٔ بانک (واریز سبز، برداشت قرمز) */}
      {miscOpen && (
        <div className="space-y-3 rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">تراکنش‌های متفرقه</h3>
            <button
              type="button"
              onClick={() => setMiscOpen(false)}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              بستن
            </button>
          </div>
          <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            واریز و برداشت‌های جدا از سهام و اقساط رسمی — متفرقه، تقسیم سود، سود بانک
            و پرداخت/برداشت قسط؛ برای همهٔ اعضا و بدون عضو.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">جمع واریز متفرقه</p>
              <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-400">{fa(miscTotals.inSum)} تومان</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-[11px] text-red-800 dark:text-red-300">جمع برداشت متفرقه</p>
              <p className="mt-1 text-sm font-black text-red-700 dark:text-red-400">{fa(miscTotals.outSum)} تومان</p>
            </div>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pl-1">
            {miscRows.length === 0 && (
              <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                هنوز تراکنش متفرقه‌ای ثبت نشده است؛ از «ثبت تراکنش» در تب تراکنش‌ها شروع کنید.
              </p>
            )}
            {miscRows.map((d) => {
              const isWithdraw = isWithdrawType(d.type);
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    isWithdraw
                      ? "border-red-200 border-r-4 border-r-red-500 bg-red-50/70 dark:border-red-900 dark:border-r-red-500 dark:bg-red-950/30"
                      : "border-emerald-200 border-r-4 border-r-emerald-500 bg-emerald-50/70 dark:border-emerald-900 dark:border-r-emerald-500 dark:bg-emerald-950/30"
                  }`}
                >
                  <ClayIcon
                    name={isWithdraw ? "withdraw" : "deposit"}
                    size={36}
                    tone={isWithdraw ? ["#FFB8A8", "#E06848"] : ["#B5EBA5", "#54B854"]}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {isWithdraw ? "برداشت" : "واریز"}
                      <span
                        className={`mr-2 rounded-lg px-2 py-0.5 text-[10px] font-normal ${
                          isWithdraw
                            ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        }`}
                      >
                        {ADMIN_MISC_TYPE_LABELS[d.type] ?? d.type}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                      {[d.memberName || "بدون عضو", d.title !== (ADMIN_MISC_TYPE_LABELS[d.type] ?? d.type) ? d.title : "", faDate(d.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-[13px] font-black ${
                      isWithdraw ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {isWithdraw ? "−" : "+"}
                    {fa(d.amount)}
                  </p>
                </div>
              );
            })}
          </div>
          {miscRows.length > 0 && (
            <p className="text-center text-[10.5px] leading-5 text-zinc-400">
              {fa(miscRows.length)} تراکنش متفرقه — همهٔ تراکنش‌ها در تب «تراکنش‌ها» هم دیده می‌شود.
            </p>
          )}
        </div>
      )}

      {/* جلسه ۶۰ — پنل «آخرین تراکنش‌ها» خانهٔ مدیر طبق طراحی PDF:
          ۴ تراکنش آخر با فلش سبز/قرمز، نام عضو، تاریخ شمسی و ±مبلغ */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <ClayIcon name="clock" size={26} />
          <h3 className="text-sm font-bold">آخرین تراکنش‌ها</h3>
        </div>
        <div className="mt-3 space-y-2">
          {lastTx.length === 0 && (
            <p className="rounded-2xl border border-zinc-200 px-4 py-5 text-center text-xs leading-6 text-zinc-500 dark:border-zinc-800">
              هنوز تراکنشی ثبت نشده است؛ از «ثبت تراکنش» در تب تراکنش‌ها شروع کنید.
            </p>
          )}
          {lastTx.map((d) => {
            const isUp = !isWithdrawType(d.type);
            return (
              <div key={d.id} className="flex items-center gap-2.5">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${
                    isUp
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                  }`}
                >
                  <TxArrow up={isUp} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                    {ADMIN_MISC_TYPE_LABELS[d.type] ?? "تراکنش"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                    {[d.memberName || "بدون عضو", faDate(d.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-[12.5px] font-black ${
                    isUp ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {isUp ? "+" : "−"}
                  {fa(d.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[11px] leading-6 text-zinc-400">
        مدیریت اعضا، وام‌ها و تنظیمات بانک در پنل مدیریت کامل انجام می‌شود؛
        تراکنش‌ها هم از نوار پایین در دسترس است.
      </p>
    </div>
  );
}
