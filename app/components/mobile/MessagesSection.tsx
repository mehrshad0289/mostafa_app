"use client";

import { useCallback, useEffect, useState } from "react";
import ClayIcon from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { AdminMessage, MemberMessage } from "@/lib/db";

/** تاریخ شمسی کوتاه */
function faDate(iso: string): string {
  try {
    const p = jalaliParts(new Date(iso));
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function faTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * بخش «پیام‌ها» در تنظیمات پنل یوزر (جلسه ۵۰ به درخواست کاربر):
 * - پیام‌هایی که مدیر خطاب به این عضو فرستاده اینجا دیده می‌شود؛
 * - عضو می‌تواند پیام یا مشکل خود را برای مدیر بنویسد؛
 * - وضعیت هر پیام عضو (ارسال‌شده / دیده‌شده) نمایش داده می‌شود.
 * همان API پیام‌رسان دوطرفهٔ جلسه ۴۹ (/api/member/messages) استفاده می‌شود؛
 * با باز شدن بخش، همه پیام‌های مدیر به‌عنوان خوانده‌شده ثبت می‌شوند.
 */
export default function MessagesSection() {
  const [fromAdmin, setFromAdmin] = useState<AdminMessage[]>([]);
  const [mySent, setMySent] = useState<MemberMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/member/messages");
      if (r.ok) {
        const d = (await r.json()) as { fromAdmin?: AdminMessage[]; mySent?: MemberMessage[] };
        setFromAdmin(Array.isArray(d.fromAdmin) ? d.fromAdmin : []);
        setMySent(Array.isArray(d.mySent) ? d.mySent : []);
      }
      // باز کردن بخش پیام‌ها = خواندن همه پیام‌های مدیر (نشان قرمز زنگوله پاک می‌شود)
      await fetch("/api/member/messages", { method: "PATCH" });
    } catch {
      // خطای موقت — دفعه بعد دوباره خوانده می‌شود
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function send() {
    if (!draft.trim()) {
      setError("متن پیام را بنویسید.");
      return;
    }
    setSending(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/member/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(d.error || "ارسال پیام ناموفق بود.");
        return;
      }
      setDraft("");
      setOk("پیام شما برای مدیر ارسال شد.");
      const r2 = await fetch("/api/member/messages");
      if (r2.ok) {
        const d2 = (await r2.json()) as { fromAdmin?: AdminMessage[]; mySent?: MemberMessage[] };
        setFromAdmin(Array.isArray(d2.fromAdmin) ? d2.fromAdmin : []);
        setMySent(Array.isArray(d2.mySent) ? d2.mySent : []);
      }
    } catch {
      setError("ارسال پیام ناموفق بود.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs text-zinc-500">در حال دریافت پیام‌ها…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fromAdmin.length === 0 && mySent.length === 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="note" size={52} className="mx-auto opacity-90" />
          <p className="mt-3 text-xs leading-6 text-zinc-500">
            هنوز پیامی بین شما و مدیر رد و بدل نشده است؛ پیام یا مشکل خود را از
            فرم پایین برای مدیر بفرستید.
          </p>
        </div>
      )}

      {fromAdmin.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
            <ClayIcon name="note" size={26} />
            پیام‌های مدیر
          </p>
          {fromAdmin.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/40"
            >
              <p className="whitespace-pre-wrap text-[12.5px] leading-6">{m.text}</p>
              <p className="mt-1.5 text-[10px] text-zinc-500">
                {faDate(m.createdAt)} — {faTime(m.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {mySent.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
            <ClayIcon name="clock" size={26} />
            پیام‌های شما به مدیر
          </p>
          {mySent.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-900 dark:bg-zinc-950"
            >
              <p className="whitespace-pre-wrap text-[12.5px] leading-6">{m.text}</p>
              <p className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                <span>
                  {faDate(m.createdAt)} — {faTime(m.createdAt)}
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 font-bold ${
                    m.read
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {m.read ? "دیده‌شده توسط مدیر" : "ارسال‌شده"}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* فرم ارسال پیام/مشکل به مدیر */}
      <div className="space-y-2 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
          <ClayIcon name="swap" size={26} />
          ارسال پیام یا مشکل به مدیر
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="متن پیام، سؤال یا مشکل خود را بنویسید…"
          className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[12.5px] leading-6 outline-none transition focus:border-primary-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-primary-600"
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {ok}
          </p>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="w-full rounded-2xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500"
        >
          {sending ? "در حال ارسال…" : "ارسال برای مدیر"}
        </button>
      </div>
    </div>
  );
}
