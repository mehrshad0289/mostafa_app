"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeSearchText } from "@/lib/bank";
import type { BankAudit } from "@/lib/db";

const AUDIT_LIMIT = 1000;

const ACTION_TONE: Record<string, string> = {
  ثبت: "border-zinc-200 text-zinc-500 dark:border-zinc-800",
  ویرایش: "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400",
  حذف: "border-red-200 text-red-700 dark:border-red-900 dark:text-red-400",
  "لغو تسویه": "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400",
  "بازیابی پشتیبان": "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400",
};

const auditDateTimeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

function faDateTime(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return auditDateTimeFmt.format(date);
}

export default function AuditTab() {
  const [records, setRecords] = useState<BankAudit[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/bank/audit?limit=${AUDIT_LIMIT}`);
        const data = (await response.json()) as BankAudit[] | { error?: string };
        if (!alive) return;
        if (!response.ok || !Array.isArray(data)) {
          setError(
            (data as { error?: string }).error || "دریافت سوابق ناموفق بود.",
          );
          return;
        }
        setRecords(data);
      } catch {
        if (alive) setError("ارتباط با سرور ناموفق بود.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!records) return [];
    const q = normalizeSearchText(query);
    if (!q) return records;
    return records.filter((r) =>
      normalizeSearchText(`${r.action} ${r.kind} ${r.detail}`).includes(q),
    );
  }, [records, query]);

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در عمل، نوع و جزئیات…"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <span className="text-xs text-zinc-500">
          {records ? `${records.length.toLocaleString("fa-IR")} رکورد (سقف ${AUDIT_LIMIT.toLocaleString("fa-IR")})` : "در حال دریافت…"}
        </span>
      </div>

      {records === null ? (
        <p className="text-sm text-zinc-500">در حال دریافت سوابق…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {records.length === 0
            ? "هنوز سوابقی ثبت نشده است."
            : "سابقه‌ای مطابق جست‌وجو پیدا نشد."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-136 text-right text-sm">
            <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">زمان</th>
                <th className="px-3 py-2 font-medium">عمل</th>
                <th className="px-3 py-2 font-medium">نوع رکورد</th>
                <th className="px-3 py-2 font-medium">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {faDateTime(r.at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] ${
                        ACTION_TONE[r.action] ?? ACTION_TONE["ثبت"]
                      }`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {r.kind}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
