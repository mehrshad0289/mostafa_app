"use client";

import { useCallback, useEffect, useState } from "react";
import ClayIcon from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { MemberNotification } from "@/lib/db";

/** تاریخ شمسی کوتاه */
function faDate(iso: string): string {
  try {
    const p = jalaliParts(new Date(iso));
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  } catch {
    return "—";
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
 * زنگوله اعلان‌های عضو (جلسه سی‌وهفتم) — دکمهٔ زنگ در هدر پنل یوزر با نشان
 * قرمز تعداد پیام‌های خوانده‌نشده؛ با لمس، پنل اعلان‌ها باز می‌شود (نتیجهٔ
 * بررسی درخواست‌ها + پیام مدیر) و همه به‌عنوان خوانده‌شده ثبت می‌شوند.
 * شمارش هر ۳۰ ثانیه به‌روز می‌شود تا پیام تازه مشخص شود.
 */
export default function MemberBell({ variant = "brand" }: { variant?: "brand" | "light" }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<MemberNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/member/notifications");
      if (!r.ok) return;
      const d = (await r.json()) as { count?: number };
      // فقط نشان قرمز به‌روز می‌شود؛ محتوای پنلِ باز با نظرسنجی پاک نمی‌شود
      setCount(Number.isFinite(d.count) ? Number(d.count) : 0);
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
      // باز کردن پنل = خواندن همه اعلان‌ها؛ نشان قرمز بلافاصله پاک می‌شود
      await fetch("/api/member/notifications", { method: "POST" });
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

  return (
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        title="اعلان‌ها و پیام‌های مدیر"
        aria-label={`اعلان‌های خوانده‌نشده: ${count}`}
        className={`clay-press relative grid size-9 place-items-center rounded-full ring-1 ring-inset transition ${
          variant === "brand"
            ? "bg-white/12 text-white/85 ring-white/20 hover:bg-white/20 hover:text-white"
            : "bg-zinc-100 text-zinc-600 ring-zinc-200 hover:bg-zinc-200 hover:text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
        }`}
      >
        <ClayIcon name="bell" size={26} ghost />
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
                <ClayIcon name="bell" size={34} />
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
            ) : items.length === 0 ? (
              <div className="py-8 text-center">
                <ClayIcon name="check" size={44} className="mx-auto" />
                <p className="mt-3 text-xs leading-6 text-zinc-500">
                  اعلان جدیدی ندارید؛ نتیجهٔ بررسی درخواست‌ها و پیام‌های مدیر
                  همین‌جا نمایش داده می‌شود.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
