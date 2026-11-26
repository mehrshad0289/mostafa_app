"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ClayIcon, { type ClayIconName, type ClayTone } from "@/app/components/mobile/ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { LoanRequest, MemberMessage, PaymentRequest, UnreadPayout } from "@/lib/db";

/**
 * زنگولهٔ اعلان‌های ادمین (جلسه ۵۱) — دکمهٔ زنگ طلایی هدر پنل مدیریت که به
 * «همهٔ» انواع پیام پاسخ می‌دهد (به درخواست کاربر):
 * ۱) درخواست‌های پرداخت خوانده‌نشده (سهام/قسط) ۲) درخواست‌های تسهیلات جدید
 * ۳) حساب‌های شبا/کارت ارسال‌شدهٔ اعضا برای واریز وام ۴) پیام‌های خوانده‌نشدهٔ
 * اعضا در پیام‌رسان. با لمس، پنل اعلان‌ها باز می‌شود و از هر بخش می‌شود مستقیم
 * به بخش مربوطه رفت (درخواست‌ها ← /admin/requests، پیام‌ها ← /bank/messages).
 * قبلاً (جلسه ۱۸ تا ۴۹) زنگ فقط درخواست‌ها را می‌شمارد و لمس آن مستقیم به
 * صفحهٔ درخواست‌ها می‌رفت؛ پیام‌های اعضا فقط بج آیتم منو داشتند.
 */

const GOLD_TONE: ClayTone = ["#FFD98E", "#F0A32B"];

type AdminBellData = {
  count?: number;
  paymentCount?: number;
  loanCount?: number;
  payoutCount?: number;
  paymentRequests?: PaymentRequest[];
  loanRequests?: LoanRequest[];
  payouts?: UnreadPayout[];
};

function faCount(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

function faMoney(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

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

/** سرصفحهٔ هر بخش اعلان با شمارنده */
function SectionHead({
  icon,
  title,
  count,
}: {
  icon: ClayIconName;
  title: string;
  count: number;
}) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
      <ClayIcon name={icon} size={26} />
      <span className="flex-1">{title}</span>
      {count > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {faCount(count)}
        </span>
      )}
    </p>
  );
}

export default function AdminBell() {
  const [data, setData] = useState<AdminBellData | null>(null);
  const [unreadMsgs, setUnreadMsgs] = useState<MemberMessage[]>([]);
  const [msgUnread, setMsgUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /** شمارش همهٔ انواع اعلان — هر ۳۰ ثانیه به‌روز می‌شود */
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/requests/unread");
      if (r.ok) setData((await r.json()) as AdminBellData);
    } catch {
      // اعلان حیاتی نیست؛ خطای موقت نادیده گرفته می‌شود
    }
    try {
      const r = await fetch("/api/admin/messages");
      if (r.ok) {
        const d = (await r.json()) as { inbox?: MemberMessage[]; unreadInbox?: number };
        const inbox = Array.isArray(d.inbox) ? d.inbox : [];
        setUnreadMsgs(inbox.filter((m) => !m.read));
        setMsgUnread(Number.isFinite(d.unreadInbox) ? Number(d.unreadInbox) : 0);
      }
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

  /** محتوای پنل هر بار باز شدن از سرور خوانده می‌شود */
  async function openPanel() {
    setOpen(true);
    setLoading(true);
    await refresh();
    setLoading(false);
  }

  const paymentCount = data?.paymentCount ?? 0;
  const loanCount = data?.loanCount ?? 0;
  const payoutCount = data?.payoutCount ?? 0;
  const paymentRequests = data?.paymentRequests ?? [];
  const loanRequests = data?.loanRequests ?? [];
  const payouts = data?.payouts ?? [];
  const total = paymentCount + loanCount + payoutCount + msgUnread;

  return (
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        title="اعلان‌ها — درخواست‌ها، تسهیلات، حساب‌های واریز و پیام‌های اعضا"
        aria-label={`اعلان‌های خوانده‌نشده: ${faCount(total)}`}
        className="clay-press relative grid size-8 place-items-center rounded-full transition"
      >
        {/* زنگولهٔ طلایی — هم‌سبک جلسه ۴۱ */}
        <ClayIcon name="bell" size={24} tone={GOLD_TONE} />
        {total > 0 && (
          <>
            <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {faCount(total)}
            </span>
            <span className="absolute -left-1 -top-1 size-2.5 animate-pulse rounded-full bg-red-500" />
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-800 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ClayIcon name="bell" size={34} tone={GOLD_TONE} />
                <h3 className="text-sm font-bold">اعلان‌ها</h3>
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
            ) : total === 0 ? (
              <div className="py-6 text-center">
                <ClayIcon name="check" size={44} className="mx-auto" />
                <p className="mt-3 text-xs leading-6 text-zinc-500">
                  اعلان جدیدی ندارید؛ درخواست‌های پرداخت، درخواست‌های تسهیلات،
                  حساب‌های واریز ارسال‌شده و پیام‌های اعضا همین‌جا اطلاع‌رسانی می‌شوند.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ۱) درخواست‌های تسهیلات جدید */}
                {loanCount > 0 && (
                  <div className="space-y-2">
                    <SectionHead icon="banknote" title="درخواست‌های تسهیلات جدید" count={loanCount} />
                    {loanRequests.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-900"
                      >
                        <p className="text-[12.5px] font-semibold">
                          درخواست تسهیلات {faMoney(r.amount)} تومانی — {faCount(r.months)} ماهه
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {r.username} · {faDate(r.createdAt)} — {faTime(r.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ۲) درخواست‌های پرداخت جدید (سهام/قسط) */}
                {paymentCount > 0 && (
                  <div className="space-y-2">
                    <SectionHead icon="coins" title="درخواست‌های پرداخت جدید" count={paymentCount} />
                    {paymentRequests.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-900"
                      >
                        <p className="text-[12.5px] font-semibold">
                          {r.kind === "share"
                            ? `پرداخت سهام ${faMoney(r.amount)} تومانی`
                            : `پرداخت قسط ${faCount(r.installmentNumber ?? 0)} — ${faMoney(r.amount)} تومان`}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {r.username} · {faDate(r.createdAt)} — {faTime(r.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ۳) حساب‌های شبا/کارت ارسال‌شده برای واریز تسهیلات */}
                {payoutCount > 0 && (
                  <div className="space-y-2">
                    <SectionHead icon="wallet" title="حساب‌های واریز جدید (شبا/کارت)" count={payoutCount} />
                    {payouts.map((p) => (
                      <div
                        key={p.requestId}
                        className="rounded-2xl border border-red-100 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30"
                      >
                        <p className="text-[12.5px] font-semibold">
                          {p.username} — تسهیلات {faMoney(p.amount)} تومانی
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          به نام {p.holder} · {faDate(p.submittedAt)} — {faTime(p.submittedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ۴) پیام‌های خوانده‌نشدهٔ اعضا (پیام‌رسان جلسه ۴۹) */}
                {msgUnread > 0 && (
                  <div className="space-y-2">
                    <SectionHead icon="note" title="پیام‌های خوانده‌نشدهٔ اعضا" count={msgUnread} />
                    {unreadMsgs.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/40"
                      >
                        <p className="whitespace-pre-wrap text-[12px] leading-6">{m.text}</p>
                        <p className="mt-1.5 text-[10px] text-zinc-500">
                          {m.fullName || m.username} · {faDate(m.createdAt)} — {faTime(m.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* پرش مستقیم به بخش مربوطه — پنل با کلیک بسته می‌شود */}
            {total > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/admin/requests"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl bg-primary-600 px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-primary-700 dark:bg-primary-500"
                >
                  مشاهده درخواست‌ها
                </Link>
                <Link
                  href="/bank/messages"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-center text-xs font-bold text-primary-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-primary-300"
                >
                  مشاهده پیام‌ها
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
