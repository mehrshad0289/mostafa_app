"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ClayIcon, { toneForSeed } from "@/app/components/mobile/ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { AdminMessage, MemberMessage } from "@/lib/db";

/**
 * پیام‌رسان مدیر ↔ اعضا (جلسه ۴۹ به درخواست کاربر: «امکان انتخاب اطلاعات برای
 * مدیر و ارسال به اعضا وجود داشته باشد»). مدیر متن پیام را می‌نویسد یا با
 * دکمهٔ «درج حساب واریز» اطلاعات حساب‌های واریز اعضا را در متن می‌گذارد و
 * گیرنده‌ها را انتخاب می‌کند (همهٔ اعضا یا اعضای منتخب). صندوق پیام‌های اعضا
 * هم همین‌جاست؛ باز شدن صفحه همه را خوانده‌شده می‌کند.
 */

type Recipient = { id: string; username: string; fullName: string; memberId: string | null };

type AccountBox = { holder: string; cardNumber: string; sheba: string };

type Overview = {
  sent: AdminMessage[];
  inbox: MemberMessage[];
  unreadInbox: number;
  recipients: Recipient[];
};

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

/** حساب واریز فعلی را به‌صورت متن خوانا برای درج در پیام می‌سازد */
function accountsText(acc: {
  primary: AccountBox;
  alternate: AccountBox;
}): string {
  const line = (label: string, a: AccountBox | undefined) => {
    if (!a || (!a.holder && !a.cardNumber && !a.sheba)) return "";
    return `${label}:\nبنام: ${a.holder || "—"}\nکارت: ${a.cardNumber || "—"}\nشبا: ${a.sheba || "—"}`;
  };
  return [line("حساب اصلی واریز", acc.primary), line("حساب جایگزین", acc.alternate)]
    .filter(Boolean)
    .join("\n\n");
}

export default function MessagesTab() {
  const [sent, setSent] = useState<AdminMessage[]>([]);
  const [inbox, setInbox] = useState<MemberMessage[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const markedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages");
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as Overview;
      setSent(Array.isArray(data.sent) ? data.sent : []);
      setInbox(Array.isArray(data.inbox) ? data.inbox : []);
      setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
    } catch {
      setError("دریافت پیام‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  // الگوی رسمی اپ: فراخوانی async داخل effect با setTimeout(0) تا setState
  // همگام در body اثر انجام نشود (قانون react-hooks/set-state-in-effect)
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // باز شدن صفحه = خواندن پیام‌های اعضا (یک بار در هر سوارشدن)
  useEffect(() => {
    if (loading || markedRef.current) return;
    markedRef.current = true;
    const timer = setTimeout(
      () => fetch("/api/admin/messages", { method: "PATCH" }).catch(() => {}),
      0,
    );
    return () => clearTimeout(timer);
  }, [loading]);

  async function insertAccounts() {
    setError("");
    try {
      const res = await fetch("/api/bank/settings");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        depositAccounts?: {
          primary: AccountBox;
          alternate: AccountBox;
        };
      };
      const acc = data.depositAccounts;
      if (!acc) {
        setError("حساب واریزی ثبت نشده است — ابتدا از بخش «حساب‌های واریز اعضا» ثبت کنید.");
        return;
      }
      const info = accountsText(acc);
      if (!info) {
        setError("حساب واریزی خالی است — ابتدا از بخش «حساب‌های واریز اعضا» ثبت کنید.");
        return;
      }
      setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${info}` : info));
    } catch {
      setError("خواندن حساب‌های واریز ناموفق بود.");
    }
  }

  async function send() {
    if (!text.trim()) {
      setError("متن پیام را بنویسید.");
      return;
    }
    if (mode === "pick" && picked.length === 0) {
      setError("حداقل یک گیرنده انتخاب کنید.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, recipients: mode === "all" ? "all" : picked }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "ارسال پیام ناموفق بود.");
        return;
      }
      setText("");
      setPicked([]);
      setSaved("پیام برای اعضا ارسال شد.");
      await load();
    } catch {
      setError("ارسال پیام ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-primary-600";

  return (
    <div className="space-y-5">
      {/* ---------- ارسال پیام ---------- */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2.5">
          <ClayIcon name="note" size={38} />
          <h3 className="text-sm font-bold">ارسال اطلاعات و پیام به اعضا</h3>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="متن پیام یا اطلاعاتی که می‌خواهید اعضا ببینند…"
          className={`${inputCls} resize-y leading-6`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void insertAccounts()}
            disabled={busy}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-primary-400 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
          >
            درج حساب واریز اعضا
          </button>
          <span className="text-[10.5px] text-zinc-400">
            {text.length.toLocaleString("fa-IR")}/۲۰۰۰
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              mode === "all"
                ? "bg-primary-600 text-white"
                : "border border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
            }`}
          >
            همهٔ اعضا
          </button>
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              mode === "pick"
                ? "bg-primary-600 text-white"
                : "border border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
            }`}
          >
            انتخاب اعضا
          </button>
        </div>

        {mode === "pick" && (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-zinc-100 p-2 dark:border-zinc-900">
            {recipients.length === 0 ? (
              <p className="p-2 text-xs text-zinc-500">کاربر عضوی برای انتخاب وجود ندارد.</p>
            ) : (
              recipients.map((r) => {
                const checked = picked.includes(r.id);
                const tone = toneForSeed(r.username);
                return (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-2xl p-2 transition ${
                      checked ? "bg-primary-50 dark:bg-primary-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPicked((prev) => (checked ? prev.filter((x) => x !== r.id) : [...prev, r.id]))
                      }
                      className="ml-1"
                    />
                    <span
                      className="clay"
                      style={{
                        width: 30,
                        height: 30,
                        background: `linear-gradient(140deg, ${tone[0]}, ${tone[1]})`,
                      }}
                    >
                      <span className="relative z-10 text-[11px] font-bold text-white">
                        {(r.fullName || r.username).trim().charAt(0)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {r.fullName || r.username}
                      </span>
                      <span className="block text-[10px] text-zinc-500" dir="ltr">
                        @{r.username}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {saved}
          </p>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
        >
          <ClayIcon name="swap" size={22} ghost ghostColor="#fff" />
          {busy ? "در حال ارسال…" : "ارسال به اعضا"}
        </button>
      </section>

      {/* ---------- صندوق پیام‌های اعضا ---------- */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ClayIcon name="bell" size={38} />
            <h3 className="text-sm font-bold">پیام‌های اعضا</h3>
          </div>
          <span className="text-[11px] text-zinc-500">
            {inbox.length.toLocaleString("fa-IR")} پیام
          </span>
        </div>
        {inbox.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            هنوز پیامی از اعضا دریافت نشده است.
          </p>
        ) : (
          <div className="space-y-2">
            {inbox.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-3 ${
                  m.read
                    ? "border-zinc-100 dark:border-zinc-900"
                    : "border-primary-200 bg-primary-50/60 dark:border-primary-800 dark:bg-primary-950/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="clay"
                      style={{
                        width: 28,
                        height: 28,
                        background: `linear-gradient(140deg, ${toneForSeed(m.username)[0]}, ${toneForSeed(m.username)[1]})`,
                      }}
                    >
                      <span className="relative z-10 text-[10px] font-bold text-white">
                        {(m.fullName || m.username).trim().charAt(0)}
                      </span>
                    </span>
                    <p className="text-[12.5px] font-bold">{m.fullName || m.username}</p>
                    {!m.read && (
                      <span className="rounded-lg bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        جدید
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {faDate(m.createdAt)} — {faTime(m.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-zinc-700 dark:text-zinc-300">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- پیام‌های ارسال‌شدهٔ مدیر ---------- */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2.5">
          <ClayIcon name="history" size={38} />
          <h3 className="text-sm font-bold">پیام‌های ارسال‌شده به اعضا</h3>
        </div>
        {sent.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">هنوز پیامی ارسال نکرده‌اید.</p>
        ) : (
          <div className="space-y-2">
            {sent.map((m) => {
              const total = m.recipients === "all" ? recipients.length : m.recipients.length;
              const reads = Object.keys(m.readBy ?? {}).filter((uid) =>
                m.recipients === "all" ? recipients.some((r) => r.id === uid) : m.recipients.includes(uid),
              ).length;
              return (
                <div key={m.id} className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-lg bg-primary-100 px-2 py-1 text-[10.5px] font-bold text-primary-800 dark:bg-primary-950/60 dark:text-primary-200">
                      {m.recipients === "all" ? "همهٔ اعضا" : `${total.toLocaleString("fa-IR")} عضو منتخب`}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {faDate(m.createdAt)} — {faTime(m.createdAt)}
                      {` · خوانده‌شده ${reads.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")}`}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-zinc-700 dark:text-zinc-300">
                    {m.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
