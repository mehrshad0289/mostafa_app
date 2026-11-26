"use client";

import { useCallback, useState } from "react";
import { jalaliParts } from "@/lib/bank";

/**
 * جلسه ۴۰ — بستن (dismiss) اعلان‌های سررسید سهام/اقساط در هر دو لایه.
 *
 * اعلان‌های سررسید ذخیره نمی‌شوند و همه از دادهٔ واقعی بانک محاسبه می‌شوند؛
 * پس وضعیت «بسته شدن» هم نباید در دیتابیس بنشیند — روی همین دستگاه در
 * localStorage نگه داشته می‌شود (مثل تم و فونت تنظیمات ظاهری).
 * کلید هر اعلان شناسهٔ آن است: نوع + ماه شمسی (+ وضعیت). با عوض شدن ماه،
 * اعلان همان ماه جدید دوباره نشان داده می‌شود؛ بستن فقط همان دوره را می‌بندد.
 *
 * محدودیت‌ها: بدون localStorage (حالت خصوصی و غیره) اعلان‌ها همیشه بازند —
 * فقط امکان بستن موقت در همان رندر می‌ماند.
 */

const PREFIX = "fambank-dismiss:";

/** آیا این اعلان قبلاً روی این دستگاه بسته شده است؟ */
export function isAlertDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

/** بستن یک اعلان با کلید مشخص */
export function dismissAlert(key: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, "1");
  } catch {
    // حالت خصوصی مرورگر و غیره — بی‌صدا رد می‌شود
  }
}

/** کلید ماه شمسی برای شناسهٔ اعلان‌های ماهانه (مثال: «1405-09») */
export function jalaliMonthKey(now: Date): string {
  try {
    const p = jalaliParts(now);
    return `${p.year}-${String(p.month).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

/**
 * هوک واکنشی «بسته‌شده بودن» یک اعلان با کلید تکی.
 * کلید null یعنی اعلان هنوز آماده نیست (قبل از لود داده) — همیشه باز.
 * خواندن localStorage در اولین رندر کلاینت انجام می‌شود؛ چون همهٔ بنرها
 * بعد از لود داده رندر می‌شوند، اختلاف hydration پیش نمی‌آید.
 */
export function useAlertDismissed(key: string | null): { dismissed: boolean; close: () => void } {
  const [state, setState] = useState<{ key: string | null; dismissed: boolean }>(() => ({
    key,
    dismissed: key !== null && isAlertDismissed(key),
  }));
  // الگوی رسمی React برای همگام‌سازی state با تغییر ورودی: تنظیم هنگام رندر
  if (key !== state.key) {
    setState({ key, dismissed: key !== null && isAlertDismissed(key) });
  }
  const close = useCallback(() => {
    if (key !== null) dismissAlert(key);
    setState({ key, dismissed: true });
  }, [key]);
  return { dismissed: state.dismissed, close };
}

/** آیا در مجموعهٔ اقلام، آیتمِ بسته‌نشده‌ای وجود دارد؟ (برای بنر معوق‌های ادمین) */
export function alertSetVisible(name: string, itemKeys: string[]): boolean {
  try {
    const raw = window.localStorage.getItem(PREFIX + name);
    const dismissed: string[] = raw ? JSON.parse(raw) : [];
    return itemKeys.some((k) => !dismissed.includes(k));
  } catch {
    return true;
  }
}

/** بستن همهٔ اقلام فعلی — قسط معوقِ جدیدی که بعداً بیاید، اعلان را دوباره باز می‌کند */
export function dismissAlertSet(name: string, itemKeys: string[]): void {
  try {
    const raw = window.localStorage.getItem(PREFIX + name);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    const merged = Array.from(new Set([...prev, ...itemKeys]));
    window.localStorage.setItem(PREFIX + name, JSON.stringify(merged));
  } catch {
    // حالت خصوصی مرورگر و غیره — بی‌صدا رد می‌شود
  }
}

/**
 * هوک واکنشی بنرهای مجموعه‌ای (مثل «اقساط سررسیدشده» ادمین): بنر باز است تا
 * وقتی حداقل یکی از اقساط معوق فعلی هنوز بسته نشده باشد. بستن بنر همهٔ
 * اقساط فعلی را بسته علامت می‌زند؛ اگر بعداً قسط معوقِ تازه‌ای بیاید
 * (کلید loanId-number جدید)، بنر دوباره باز می‌شود — پرداخت بخشی از اقساط
 * بنر را دوباره باز نمی‌کند.
 */
export function useAlertSetVisible(
  name: string,
  itemKeys: string[] | null,
): { visible: boolean; close: () => void } {
  const fingerprint = itemKeys ? itemKeys.slice().sort().join("|") : null;
  const [state, setState] = useState<{ fp: string | null; visible: boolean }>(() => ({
    fp: fingerprint,
    visible: fingerprint !== null && alertSetVisible(name, itemKeys ?? []),
  }));
  if (fingerprint !== state.fp) {
    setState({ fp: fingerprint, visible: fingerprint !== null && alertSetVisible(name, itemKeys ?? []) });
  }
  const close = useCallback(() => {
    if (itemKeys && itemKeys.length > 0) dismissAlertSet(name, itemKeys);
    setState({ fp: fingerprint, visible: false });
  }, [name, itemKeys, fingerprint]);
  return { visible: state.visible, close };
}
