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
      setError("دریافت اطلاعات صندوق ناموفق بود.");
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
        className="flex flex-wrap items-start justify-between gap-3"
        data-noprint
      >
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">صندوق قرض‌الحسنه</p>
          <h1 className="text-3xl font-semibold tracking-tight">فم بانک</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            مدیریت اعضا، واریزی‌ها، وام‌ها و گزارش‌های صندوق.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLocked(true)}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
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
        className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← بازگشت به Mostafa App
      </Link>

      <section className="grid grid-cols-3 gap-3" data-noprint>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">موجودی صندوق</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">
            {faNum(summary.balance)}
            <span className="mr-1 text-xs font-normal text-zinc-500">تومان</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">جمع سهم‌ها</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">{faNum(summary.totalShares)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">تعداد اعضا</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">{faNum(members.length)}</p>
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
            className={
              tab === t.key
                ? "rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
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
