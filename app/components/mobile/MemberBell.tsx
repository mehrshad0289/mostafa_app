"use client";

import { useCallback, useEffect, useState } from "react";
import ClayIcon, { type ClayTone } from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { AdminMessage, MemberMessage, MemberNotification } from "@/lib/db";

/** جلسه ۴۰ — تِم طلایی زنگوله (هم‌خانوادهٔ رنگ طلایی آیکون‌های اپ) به درخواست کاربر */
const GOLD_TONE: ClayTone = ["#FFD98E", "#F0A32B"];

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

function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

/** عنوان فارسی هر اعلان بر اساس نوع آن */
function notifTitle(n: MemberNotification): string {
  if (n.kind === "loan") return `درخواست تسهیلات ${faMoney(n.amount)} تومانی`;
  if (n.kind === "share") return `پرداخت سهام ${faMoney(n.amount)} تومانی`;
  return `پرداخت قسط ${(n.installmentNumber ?? 0).toLocaleString("fa-IR")} — ${faMoney(n.amount)} تومان`;
}

/**
 * زنگوله اعلان‌ها و پیام‌های عضو (جلسه سی‌وهفتم) — دکمهٔ زنگ در هدر پنل یوزر با
 * نشان قرمز تعداد پیام‌های خوانده‌نشده؛ با لمس، پنل اعلان‌ها باز می‌شود (نتیجهٔ
 * بررسی درخواست‌ها + پیام مدیر) و همه به‌عنوان خوانده‌شده ثبت می‌شوند.
 * جلسه ۴۹: پیام‌رسان دوطرفه — پیام‌های مستقیم مدیر خطاب به عضو در همین پنل
 * دیده می‌شود و عضو می‌تواند از پایین پنل پیام به مدیر بفرستد و وضعیت
 * پیام‌های خودش را ببیند.
 * جلسه ۴۰: زنگوله طلایی و متمایز (به درخواست کاربر).
 */
export default function MemberBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [adminMsgs, setAdminMsgs] = useState<AdminMessage[]>([]);
  const [mySent, setMySent] = useState<MemberMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendOk, setSendOk] = useState("");

  const refresh = useCallback(async () => {
    try {
      let total = 0;
      const r1 = await fetch("/api/member/notifications");
      if (r1.ok) {
        const d = (await r1.json()) as { count?: number };
        total += Number.isFinite(d.count) ? Number(d.count) : 0;
      }
      const r2 = await fetch("/api/member/messages");
      if (r2.ok) {
        const d = (await r2.json()) as { unreadCount?: number };
        total += Number.isFinite(d.unreadCount) ? Number(d.unreadCount) : 0;
      }
      // فقط نشان قرمز به‌روز می‌شود؛ محتوای پنلِ باز با نظرسنجی پاک نمی‌شود
      setCount(total);
    } catch {
      // اعلان حیاتی نیست؛ خطای موقت نادیده گرفته می‌شود
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refresh]);

  /** محتوای پنل — هر بار باز شدن از سرور خوانده می‌شود */
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/member/notifications");
      if (r.ok) {
        const d = (await r.json()) as { items?: MemberNotification[] };
        setItems(Array.isArray(d.items) ? d.items : []);
      }
      const r2 = await fetch("/api/member/messages");
      if (r2.ok) {
        const d = (await r2.json()) as { fromAdmin?: AdminMessage[]; mySent?: MemberMessage[] };
        setAdminMsgs(Array.isArray(d.fromAdmin) ? d.fromAdmin : []);
        setMySent(Array.isArray(d.mySent) ? d.mySent : []);
      }
      // باز کردن پنل = خواندن همه اعلان‌ها و پیام‌ها؛ نشان قرمز بلافاصله پاک می‌شود
      await fetch("/api/member/notifications", { method: "POST" });
      await fetch("/api/member/messages", { method: "PATCH" });
      setCount(0);
    } catch {
      // خطای موقت — دفعه بعد شمرده می‌شود
    } finally {
      setLoading(false);
    }
  }, []);

  async function openPanel() {
    setOpen(true);
    await loadItems();
  }

  async function sendMessage() {
    if (!draft.trim()) {
      setSendError("متن پیام را بنویسید.");
      return;
    }
    setSending(true);
    setSendError("");
    setSendOk("");
    try {
      const res = await fetch("/api/member/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSendError(d.error || "ارسال پیام ناموفق بود.");
        return;
      }
      setDraft("");
      setSendOk("پیام شما برای مدیر ارسال شد.");
      const r2 = await fetch("/api/member/messages");
      if (r2.ok) {
        const d2 = (await r2.json()) as { fromAdmin?: AdminMessage[]; mySent?: MemberMessage[] };
        setAdminMsgs(Array.isArray(d2.fromAdmin) ? d2.fromAdmin : []);
        setMySent(Array.isArray(d2.mySent) ? d2.mySent : []);
      }
    } catch {
      setSendError("ارسال پیام ناموفق بود.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        title="اعلان‌ها و پیام‌های مدیر"
        aria-label={`اعلان‌های خوانده‌نشده: ${count}`}
        className="clay-press relative grid size-9 place-items-center rounded-full transition"
      >
        {/* جلسه ۴۰: زنگوله طلایی و متمایز (به درخواست کاربر) — در هر دو واریانت
            هدر تیرهٔ پوسته موبایل و هدر روشن /dashboard */}
        <ClayIcon name="bell" size={30} tone={GOLD_TONE} />
        {count > 0 && (
          <>
            <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {count.toLocaleString("fa-IR")}
            </span>
            <span className="absolute -left-1 -top-1 size-2.5 animate-pulse rounded-full bg-red-500" />
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {/* رنگ متن صریح — مودال داخل هدر سفیدمتن است و باید رنگ خودش را داشته باشد */}
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-800 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ClayIcon name="bell" size={34} tone={GOLD_TONE} />
                <h3 className="text-sm font-bold">اعلان‌ها و پیام‌های مدیر</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن"
                className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                ×
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-zinc-500">در حال دریافت…</p>
            ) : (
              <>
                {/* جلسه ۴۹ — پیام‌های مستقیم مدیر خطاب به این عضو */}
                {adminMsgs.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      <ClayIcon name="note" size={26} />
                      پیام‌های مدیر
                    </p>
                    {adminMsgs.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/40"
                      >
                        <p className="whitespace-pre-wrap text-[12px] leading-6">{m.text}</p>
                        <p className="mt-1.5 text-[10px] text-zinc-500">
                          {faDate(m.createdAt)} — {faTime(m.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {items.length === 0 && adminMsgs.length === 0 ? (
                  <div className="py-6 text-center">
                    <ClayIcon name="check" size={44} className="mx-auto" />
                    <p className="mt-3 text-xs leading-6 text-zinc-500">
                      اعلان و پیام جدیدی ندارید؛ نتیجهٔ بررسی درخواست‌ها و پیام‌های
                      مدیر همین‌جا نمایش داده می‌شود.
                    </p>
                  </div>
                ) : (
                  items.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        <ClayIcon name="history" size={26} />
                        نتیجهٔ بررسی درخواست‌ها
                      </p>
                      {items.map((n) => (
                        <div
                          key={`${n.kind}-${n.id}`}
                          className="flex items-start gap-3 rounded-2xl border border-zinc-100 p-3 dark:border-zinc-900"
                        >
                          <ClayIcon
                            name={n.kind === "loan" ? "banknote" : n.kind === "share" ? "coins" : "calendar"}
                            size={38}
                            className="shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">{notifTitle(n)}</p>
                              <span
                                className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                                  n.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                                }`}
                              >
                                {n.status === "approved" ? "تأیید شد" : "رد شد"}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              {faDate(n.reviewedAt)}
                              {n.kind === "loan" && n.months ? ` — ${n.months.toLocaleString("fa-IR")} ماهه` : ""}
                            </p>
                            {n.reviewNote && (
                              <p className="rounded-xl bg-amber-100/70 px-3 py-1.5 text-[11px] leading-5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                پیام مدیر: {n.reviewNote}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* جلسه ۴۹ — ارسال پیام به مدیر (امکان پیام‌رسان برای یوزرها) */}
                <div className="mt-5 space-y-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    <ClayIcon name="swap" size={26} />
                    ارسال پیام به مدیر
                  </p>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="متن پیام یا اطلاعاتی که می‌خواهید مدیر ببیند…"
                    className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[12.5px] leading-6 outline-none transition focus:border-primary-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-primary-600"
                  />
                  {sendError && (
                    <p className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {sendError}
                    </p>
                  )}
                  {sendOk && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {sendOk}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={sending}
                    className="w-full rounded-2xl bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500"
                  >
                    {sending ? "در حال ارسال…" : "ارسال پیام"}
                  </button>
                </div>

                {/* پیام‌های خود عضو و وضعیت خوانده‌شدن توسط مدیر */}
                {mySent.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      <ClayIcon name="clock" size={26} />
                      پیام‌های شما به مدیر
                    </p>
                    {mySent.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-900"
                      >
                        <p className="whitespace-pre-wrap text-[12px] leading-6">{m.text}</p>
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
                            {m.read ? "دیده‌شده" : "ارسال‌شده"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
