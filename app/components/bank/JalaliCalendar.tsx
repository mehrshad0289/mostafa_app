"use client";

import { useState } from "react";
import { jalaliMonthLength, jalaliParts, jalaliToGregorian } from "@/lib/bank";
import { useHydrated } from "./useHydrated";

const WEEKDAYS = [
  "شنبه",
  "یک‌شنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
];

const MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// تشخیص hydration بدون اثر جانبی — هوک مشترک در useHydrated.ts

type JalaliCalendarProps = {
  /** تاریخ انتخاب‌شده به شکل رشته ISO؛ رشته خالی یعنی هنوز انتخابی ثبت نشده */
  value: string;
  onChange: (iso: string) => void;
};

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

function hhmmOf(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function JalaliCalendar({ value, onChange }: JalaliCalendarProps) {
  const hydrated = useHydrated();
  // ماه نمایشی: اگر کاربر با «ماه قبل/بعد» جابه‌جا شده همان می‌ماند، وگرنه از value
  const [manualNav, setManualNav] = useState<{ year: number; month: number } | null>(null);
  const [typedTime, setTypedTime] = useState("");

  const derived = value
    ? jalaliParts(new Date(value))
    : hydrated
      ? jalaliParts(new Date())
      : null;
  const view = manualNav ?? derived;
  const time =
    typedTime || (value ? hhmmOf(value) : hydrated ? hhmmOf(new Date().toISOString()) : "");
  const today = hydrated ? jalaliParts(new Date()) : null;
  const selected = value ? jalaliParts(new Date(value)) : null;

  function emitDay(jd: number) {
    if (!view) return;
    const gregorian = jalaliToGregorian(view.year, view.month, jd);
    if (!gregorian) return;
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    gregorian.setHours(match ? Number(match[1]) : 12, match ? Number(match[2]) : 0, 0, 0);
    setManualNav(null);
    setTypedTime("");
    onChange(gregorian.toISOString());
  }

  function changeTime(next: string) {
    setTypedTime(next);
    if (!value) return;
    const date = new Date(value);
    const match = next.match(/^(\d{1,2}):(\d{2})$/);
    if (Number.isNaN(date.getTime()) || !match) return;
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    onChange(date.toISOString());
  }

  function shiftMonth(delta: number) {
    if (!view) return;
    let year = view.year;
    let month = view.month + delta;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setManualNav({ year, month });
  }

  const length = view ? jalaliMonthLength(view.year, view.month) : 0;
  const first = view ? jalaliToGregorian(view.year, view.month, 1) : null;
  // ستون اول تقویم شنبه است؛ getDay یک‌شنبه=0 … جمعه=5، شنبه=6
  const lead = first ? (first.getDay() + 1) % 7 : 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          ماه قبل
        </button>
        <p className="text-sm font-medium">
          {view ? `${MONTH_NAMES[view.month - 1]} ${faNum(view.year)}` : "…"}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-primary-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          ماه بعد
        </button>
      </div>

      {view ? (
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <p key={day} className="pb-1 text-[11px] text-zinc-500">
              {day}
            </p>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {Array.from({ length }).map((_, i) => {
            const day = i + 1;
            const isSelected =
              !!selected &&
              selected.year === view.year &&
              selected.month === view.month &&
              selected.day === day;
            const isToday =
              !!today &&
              today.year === view.year &&
              today.month === view.month &&
              today.day === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => emitDay(day)}
                className={
                  isSelected
                    ? "rounded-lg bg-emerald-600 py-1.5 text-sm text-white"
                    : isToday
                      ? "rounded-lg py-1.5 text-sm text-emerald-600 ring-1 ring-inset ring-emerald-500 dark:text-emerald-400"
                      : "rounded-lg py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }
              >
                {faNum(day)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          تقویم پس از باز شدن صفحه آماده می‌شود.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label className="text-sm text-zinc-600 dark:text-zinc-400" htmlFor="bank-time">
          ساعت
        </label>
        <input
          id="bank-time"
          type="time"
          value={time}
          onChange={(e) => changeTime(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <p className="text-xs text-zinc-500">پیش‌فرض زمان فعلی؛ قابل ویرایش است.</p>
      </div>
    </div>
  );
}
