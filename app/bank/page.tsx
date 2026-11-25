"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClayIcon, { type ClayIconName } from "@/app/components/mobile/ClayIcon";
import MembersTab from "@/app/components/bank/MembersTab";
import DepositsTab from "@/app/components/bank/DepositsTab";
import LoansTab from "@/app/components/bank/LoansTab";
import ReportsTab from "@/app/components/bank/ReportsTab";
import SettingsTab from "@/app/components/bank/SettingsTab";
import AuditTab from "@/app/components/bank/AuditTab";
import ManagerLock from "@/app/components/bank/ManagerLock";
import { recalcFund } from "@/lib/bank";
import type { BankDeposit, BankLoan, BankMember, BankSettings } from "@/lib/db";

type TabKey = "members" | "deposits" | "loans" | "reports" | "settings" | "audit";

const TABS: { key: TabKey; label: string; icon: ClayIconName }[] = [
  { key: "members", label: "اعضا", icon: "user" },
  { key: "deposits", label: "تراکنش‌ها", icon: "swap" },
  { key: "loans", label: "وام‌ها", icon: "banknote" },
  { key: "reports", label: "گزارش‌ها", icon: "chart" },
  { key: "settings", label: "تنظیمات", icon: "settings" },
  { key: "audit", label: "سوابق", icon: "history" },
];

const BRAND_TONE: [string, string] = ["#6198F7", "#1A46AF"];

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

export default function BankPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("members");
  const [members, setMembers] = useState<BankMember[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<BankSettings | null>(null);
  /** قفل ظاهری مدیر (استپ ۱۵) — PIN هش‌شده در localStorage، جدا از داده سرور */
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = (await fetch("/api/bank/members").then((r) => r.json())) as BankMember[];
      const d = (await fetch("/api/bank/deposits").then((r) => r.json())) as BankDeposit[];
      const l = (await fetch("/api/bank/loans").then((r) => r.json())) as BankLoan[];
      const s = (await fetch("/api/bank/settings").then((r) => r.json())) as BankSettings;
      setMembers(Array.isArray(m) ? m : []);
      setDeposits(Array.isArray(d) ? d : []);
      setLoans(Array.isArray(l) ? l : []);
      setSettings(s && typeof s === "object" ? s : null);
    } catch {
      setError("دریافت اطلاعات بانک ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // فراخوانی غیرهمزمان — سازگار با قانون react-hooks/set-state-in-effect
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    // گارد دسترسی: فقط ادمین؛ عضو به /dashboard و مهمان به /login می‌رود (غیرهمزمان)
    const timer = setTimeout(() => {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d: { user?: { role: string } | null }) => {
          if (!d.user) router.replace("/login");
          else if (d.user.role !== "admin") router.replace("/dashboard");
        })
        .catch(() => router.replace("/login"));
      // لینک عمیق ?tab= از منوی پنل ادمین (بعد از mount)
      const param = new URLSearchParams(window.location.search).get("tab");
      if (param && TABS.some((t) => t.key === param)) {
        setTab(param as TabKey);
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(
    () => recalcFund({ members, deposits, loans }),
    [members, deposits, loans],
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      {/* هدر برند فم بانک — هم‌سبک با پوسته یوزر */}
      <header className="flex flex-wrap items-center justify-between gap-3" data-noprint>
        <div className="flex items-center gap-2.5">
          <span
            className="clay"
            style={{ width: 52, height: 52, background: `linear-gradient(140deg, ${BRAND_TONE[0]}, ${BRAND_TONE[1]})` }}
          >
            <span className="relative z-10 -mb-px text-sm font-black tracking-tight text-white">FB</span>
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">فم بانک</h1>
          </div>
        </div>
        <button type="button" onClick={() => setLocked(true)} className="btn-outline">
          قفل مدیر
        </button>
      </header>

      {locked ? (
        <ManagerLock onUnlock={() => setLocked(false)} />
      ) : (
        <>
      <Link
        href="/"
        data-noprint
        className="text-sm font-medium text-primary-700 underline-offset-4 hover:underline dark:text-primary-300"
      >
        ← بازگشت به Mostafa App
      </Link>

      {/* هیرو گرادیان خلاصه بانک — هم‌سبک با هدر موجودی تراکنش‌ها */}
      <section
        className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary-700 via-primary-800 to-primary-950 p-5 text-white shadow-lg shadow-primary-900/30"
        data-noprint
      >
        <div className="pointer-events-none absolute -left-10 -top-10 size-36 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 left-16 size-44 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs font-medium text-white/70">خلاصه بانک</p>
          <p className="mt-1 text-[27px] font-black leading-9 tracking-tight">
            {faNum(summary.balance)} <span className="text-base font-bold text-white/80">تومان</span>
          </p>
          <p className="mt-0.5 text-[11px] text-white/55">موجودی بانک</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <p className="text-white/60">جمع سهم‌ها</p>
              <p className="mt-0.5 font-bold">{faNum(summary.totalShares)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <p className="text-white/60">تعداد اعضا</p>
              <p className="mt-0.5 font-bold">{faNum(members.length)}</p>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <p className="text-sm text-zinc-500" data-noprint>
          در حال دریافت اطلاعات…
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" data-noprint>
          {error}
        </p>
      )}

      <nav className="flex flex-wrap gap-2" data-noprint>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
              tab === t.key
                ? "bg-gradient-to-l from-primary-700 to-primary-500 text-white shadow-md shadow-primary-600/25"
                : "border border-zinc-200 bg-white text-zinc-500 hover:border-primary-300 hover:text-primary-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-primary-700 dark:hover:text-primary-300"
            }`}
          >
            {tab === t.key ? (
              <ClayIcon name={t.icon} size={22} ghost ghostColor="#fff" />
            ) : (
              <ClayIcon name={t.icon} size={22} ghost ghostColor="currentColor" />
            )}
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "members" ? (
        <MembersTab
          members={members}
          deposits={deposits}
          loans={loans}
          amountPerShare={settings?.amountPerShare ?? 0}
          onRefresh={load}
        />
      ) : tab === "deposits" ? (
        <DepositsTab
          members={members}
          deposits={deposits}
          loans={loans}
          settings={settings}
          onRefresh={load}
        />
      ) : tab === "loans" ? (
        <LoansTab members={members} loans={loans} onRefresh={load} />
      ) : tab === "reports" ? (
        <ReportsTab
          members={members}
          deposits={deposits}
          loans={loans}
          amountPerShare={settings?.amountPerShare ?? 0}
        />
      ) : tab === "settings" ? (
        <SettingsTab settings={settings} onRefresh={load} />
      ) : tab === "audit" ? (
        <AuditTab />
      ) : null}
        </>
      )}
    </main>
  );
}
