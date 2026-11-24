"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const TABS: { key: TabKey; label: string }[] = [
  { key: "members", label: "اعضا" },
  { key: "deposits", label: "واریزی‌ها" },
  { key: "loans", label: "وام‌ها" },
  { key: "reports", label: "گزارش‌ها" },
  { key: "settings", label: "تنظیمات" },
  { key: "audit", label: "سوابق" },
];

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header
        className="card flex flex-wrap items-center justify-between gap-3 p-5"
        data-noprint
      >
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-600 text-white shadow-sm dark:bg-primary-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
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
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">فم بانک</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              مدیریت اعضا، واریزی‌ها، وام‌ها و گزارش‌های بانک.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLocked(true)}
          className="btn-outline"
        >
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

      <section className="grid grid-cols-3 gap-3" data-noprint>
        <div className="card p-4">
          <p className="text-xs text-zinc-500">موجودی بانک</p>
          <p className="mt-1 text-lg font-bold text-primary-700 sm:text-xl dark:text-primary-300">
            {faNum(summary.balance)}
            <span className="mr-1 text-xs font-normal text-zinc-500">تومان</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-zinc-500">جمع سهم‌ها</p>
          <p className="mt-1 text-lg font-bold sm:text-xl">{faNum(summary.totalShares)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-zinc-500">تعداد اعضا</p>
          <p className="mt-1 text-lg font-bold sm:text-xl">{faNum(members.length)}</p>
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

      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
        data-noprint
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "min-w-fit flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm dark:bg-zinc-800 dark:text-primary-300"
                : "min-w-fit flex-1 rounded-xl px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
            }
          >
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
