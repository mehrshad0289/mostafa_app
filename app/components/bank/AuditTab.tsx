"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeSearchText } from "@/lib/bank";
import ClayIcon from "@/app/components/mobile/ClayIcon";
import type { BankAudit } from "@/lib/db";

/**
 * جلسه ۴۸ — حذف سوابق به درخواست کاربر («بتوان سوابق را حذف کرد در صورت نیاز»):
 * دکمه حذف کنار هر ردیف + دکمه «پاک‌کردن همه»؛ هر دو با پنجره تأیید و بعد از
 * حذف، لیست دوباره بارگذاری می‌شود. حذف خودش یک رکورد سابقه ثبت می‌کند.
 */

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

type ConfirmTarget = { kind: "one"; record: BankAudit } | { kind: "all" } | null;

export default function AuditTab() {
  const [records, setRecords] = useState<BankAudit[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/bank/audit?limit=${AUDIT_LIMIT}`);
      const data = (await response.json()) as BankAudit[] | { error?: string };
      if (!response.ok || !Array.isArray(data)) {
        setError(
          (data as { error?: string }).error || "دریافت سوابق ناموفق بود.",
        );
        return;
      }
      setError("");
      setRecords(data);
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    }
  }

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

  async function submitDelete() {
    if (!confirmTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body =
        confirmTarget.kind === "all"
          ? { all: true }
          : { ids: [confirmTarget.record.id] };
      const response = await fetch("/api/bank/audit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { removed?: number; error?: string };
      if (!response.ok) {
        setError(data.error || "حذف سابقه ناموفق بود.");
        return;
      }
      setNotice(
        `${Number(data.removed ?? 0).toLocaleString("fa-IR")} رکورد سابقه حذف شد.`,
      );
      setConfirmTarget(null);
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  if (error && !confirmTarget && records === null) {
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
        {/* جلسه ۴۸: پاک‌کردن همه سوابق — با پنجره تأیید */}
        <button
          type="button"
          onClick={() => setConfirmTarget({ kind: "all" })}
          disabled={records === null || records.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
        >
          <ClayIcon name="trash" size={20} ghost ghostColor="currentColor" />
          پاک‌کردن همه
        </button>
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && records !== null && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

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
                <th className="px-3 py-2 font-medium">حذف</th>
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
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ kind: "one", record: r })}
                      aria-label="حذف این سابقه"
                      title="حذف این سابقه"
                      className="grid size-7 place-items-center rounded-lg text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      <ClayIcon name="trash" size={18} ghost ghostColor="currentColor" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* پنجره تأیید حذف */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-noprint>
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <ClayIcon name="trash" size={44} tone={["#FCA9A9", "#D95050"]} />
            <h3 className="mt-3 text-sm font-bold">
              {confirmTarget.kind === "all" ? "پاک‌کردن همه سوابق" : "حذف این سابقه"}
            </h3>
            <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              {confirmTarget.kind === "all"
                ? "همه رکوردهای سوابق حذف می‌شوند و این عمل قابل بازگشت نیست. مطمئنید؟"
                : `سابقه «${confirmTarget.record.action} — ${confirmTarget.record.kind}» حذف می‌شود. مطمئنید؟`}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void submitDelete()}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "در حال حذف…" : "حذف"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={busy}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
