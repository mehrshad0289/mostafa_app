"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "./useHydrated";

/** تم‌های رنگی — فقط متغیرهای رنگ برند (--color-primary-*) عوض می‌شوند.
 *  جلسه ۳۳: سه تم جدید (آبی آسمانی روشن‌تر، سرخابی، کهربایی) به درخواست
 *  «رنگ‌های بیشتر» اضافه شد — مجموع ۸ تم
 *  جلسه ۳۵: تم پیش‌فرض به «فیروزه‌ای برند» تغییر کرد.
 *  جلسه ۳۷: تم پیش‌فرض به «آبی آسمانی» تغییر کرد (به درخواست کاربر)؛ کلید
 *  قبلی sky به «آبی بانکی» (آبی عمیق‌تر) تغییر مقدار داد — پالت پیش‌فرض در globals.css */
const THEMES: {
  key: string;
  label: string;
  swatches: [string, string, string];
}[] = [
  { key: "default", label: "آبی آسمانی", swatches: ["#0369a1", "#38bdf8", "#7dd3fc"] },
  { key: "sky", label: "آبی بانکی", swatches: ["#1d4ed8", "#3b82f6", "#93c5fd"] },
  { key: "emerald", label: "زمردی", swatches: ["#059669", "#10b981", "#6ee7b7"] },
  { key: "teal", label: "فیروزه‌ای", swatches: ["#0d9488", "#14b8a6", "#5eead4"] },
  { key: "violet", label: "بنفش", swatches: ["#7c3aed", "#8b5cf6", "#c4b5fd"] },
  { key: "rose", label: "سرخابی", swatches: ["#e11d48", "#fb7185", "#fda4af"] },
  { key: "sunset", label: "نارنجی گرم", swatches: ["#ea580c", "#f97316", "#fdba74"] },
  { key: "amber", label: "کهربایی", swatches: ["#d97706", "#fbbf24", "#fcd34d"] },
];

/** فونت‌های فارسی — متغیرهای next/font در layout لود شده‌اند */
const FONTS: { key: string; label: string; cssVar: string; note: string }[] = [
  { key: "vazir", label: "وزیرمتن", cssVar: "var(--font-vazir)", note: "پیش‌فرض — خوانا و بانکی" },
  { key: "naskh", label: "نسخ", cssVar: "var(--font-naskh)", note: "کلاسیک و سنتی" },
  { key: "markazi", label: "مرکزی", cssVar: "var(--font-markazi)", note: "مطبوعاتی و لطیف" },
  { key: "lalezar", label: "لاله‌زار", cssVar: "var(--font-lalezar)", note: "تیتری و پررنگ" },
];

const MODES: { key: "system" | "light" | "dark"; label: string }[] = [
  { key: "system", label: "هم‌راه با سیستم" },
  { key: "light", label: "روشن" },
  { key: "dark", label: "تاریک" },
];

type Appearance = { theme: string; font: string; mode: "system" | "light" | "dark" };

const STORAGE_KEY = "mostafa-appearance";

/** خواندن تنظیمات فعلی از attributeهای <html> — فقط سمت کلاینت */
function readCurrent(): Appearance {
  const el = document.documentElement;
  const mode = el.dataset.mode === "dark" || el.dataset.mode === "light" ? el.dataset.mode : "system";
  return {
    theme: THEMES.some((t) => t.key === el.dataset.theme) ? (el.dataset.theme as string) : "default",
    font: FONTS.some((f) => f.key === el.dataset.font) ? (el.dataset.font as string) : "vazir",
    mode,
  };
}

/** اعمال ظاهر روی <html> و ذخیره در localStorage همین مرورگر */
function apply(next: Appearance) {
  const el = document.documentElement;
  if (next.theme === "default") delete el.dataset.theme;
  else el.dataset.theme = next.theme;
  if (next.font === "vazir") delete el.dataset.font;
  else el.dataset.font = next.font;
  const resolved =
    next.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : next.mode;
  el.dataset.mode = resolved;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // بدون localStorage (حالت ناشناس) فقط همین بار اعمال می‌شود
  }
}

/**
 * تنظیمات ظاهری اپ: تم رنگی، حالت نمایش (روشن/تاریک/سیستم) و فونت.
 * مشترک بین پنل ادمین (تب تنظیمات فم بانک) و پنل عضو (تب تنظیمات).
 * تغییرها بلافاصله روی کل اپ اعمال و در localStorage همین دستگاه ذخیره می‌شوند.
 */
export default function AppearanceSettings() {
  const hydrated = useHydrated();
  const [appearance, setAppearance] = useState<Appearance>({
    theme: "default",
    font: "vazir",
    mode: "system",
  });
  const [synced, setSynced] = useState<Appearance | null>(null);

  // الگوی رسمی React: خواندن وضعیت واقعی <html> بعد از hydration و تنظیم state
  // هنگام رندر با مقایسه مقدار قبلی (بدون setState داخل effect)
  if (hydrated && synced === null) {
    const current = readCurrent();
    setSynced(current);
    setAppearance(current);
  }

  // در حالت «هم‌راه با سیستم»، تغییر تم سیستم همان لحظه اعمال شود
  useEffect(() => {
    if (!hydrated || appearance.mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const el = document.documentElement;
      el.dataset.mode = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [hydrated, appearance.mode]);

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    apply(next);
  }

  const optionClass = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-sm transition ${
      active
        ? "border-primary-600 bg-primary-600 font-medium text-white dark:border-primary-500 dark:bg-primary-600 dark:text-white"
        : "border-zinc-200 text-zinc-600 hover:border-primary-300 hover:text-primary-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-primary-700 dark:hover:text-primary-300"
    }`;

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h3 className="text-sm font-medium">ظاهر اپ</h3>
        <p className="mt-1 text-xs text-zinc-500">
          تم رنگی، حالت نمایش و فونت را انتخاب کنید؛ تغییرها همان لحظه روی کل اپ
          اعمال می‌شود و روی همین مرورگر/دستگاه ذخیره می‌ماند.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">تم رنگی</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => update({ theme: t.key })}
              className={`flex items-center gap-2 ${optionClass(hydrated && appearance.theme === t.key)}`}
            >
              <span className="flex -space-x-1">
                {t.swatches.map((c) => (
                  <span
                    key={c}
                    className="size-4 rounded-full border border-white/70 dark:border-zinc-950/70"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">حالت نمایش</p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => update({ mode: m.key })}
              className={optionClass(hydrated && appearance.mode === m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">فونت</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => update({ font: f.key })}
              className={`rounded-xl border px-3 py-2.5 text-right transition ${
                hydrated && appearance.font === f.key
                  ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/50"
                  : "border-zinc-200 hover:border-primary-300 dark:border-zinc-800 dark:hover:border-primary-700"
              }`}
            >
              <span
                className="block text-base font-semibold"
                style={{ fontFamily: `${f.cssVar}, Tahoma, sans-serif` }}
              >
                {f.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">{f.note}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
