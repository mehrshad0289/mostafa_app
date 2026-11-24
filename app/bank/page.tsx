"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MembersTab from "@/app/components/bank/MembersTab";
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

const TAB_PLACEHOLDER: Record<TabKey, string> = {
  members: "پنل اعضا در استپ بعدی تکمیل می‌شود.",
  deposits: "پنل واریزی‌ها در استپ بعدی تکمیل می‌شود.",
  loans: "پنل وام‌ها و اقساط در استپ بعدی تکمیل می‌شود.",
  reports: "گزارش‌ها و گردش ماهانه در استپ بعدی تکمیل می‌شود.",
  settings: "تنظیمات صندوق در استپ بعدی تکمیل می‌شود.",
  audit: "فهرست سوابق ثبت/ویرایش/حذف در استپ بعدی تکمیل می‌شود.",
};

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

export default function BankPage() {
  const [tab, setTab] = useState<TabKey>("members");
  const [members, setMembers] = useState<BankMember[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<BankSettings | null>(null);

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

  const summary = useMemo(
    () => recalcFund({ members, deposits, loans }),
    [members, deposits, loans],
  );

  const tabCount: Record<TabKey, string | null> = {
    members: `${faNum(members.length)} عضو ثبت شده است.`,
    deposits: `${faNum(deposits.length)} واریزی ثبت شده است.`,
    loans: `${faNum(loans.length)} وام ثبت شده است.`,
    reports: null,
    settings: null,
    audit: null,
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">صندوق قرض‌الحسنه</p>
        <h1 className="text-3xl font-semibold tracking-tight">بانک حقیقی</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          مدیریت اعضا، واریزی‌ها، وام‌ها و گزارش‌های صندوق.
        </p>
      </header>

      <Link
        href="/"
        className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← بازگشت به Mostafa App
      </Link>

      <section className="grid grid-cols-3 gap-3">
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
        <p className="text-sm text-zinc-500">در حال دریافت اطلاعات…</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <nav className="flex flex-wrap gap-2">
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
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-medium">
            {TABS.find((t) => t.key === tab)?.label}
          </h2>
          <div className="mt-1">
            {tabCount[tab] && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tabCount[tab]}
              </p>
            )}
            <p className="mt-2 text-sm text-zinc-500">{TAB_PLACEHOLDER[tab]}</p>
          </div>
        </section>
      )}
    </main>
  );
}
