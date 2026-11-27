"use client";

import { useEffect, useRef } from "react";

/**
 * جلسه ۵۴ — گارد دکمهٔ برگشت گوشی/مرورگر (به درخواست کاربر: «با زدن دکمهٔ
 * برگشت گوشی از برنامه خارج نشود و به مرحله قبل باز گردد»).
 *
 * الگوی «نشانهٔ تاریخ + پشتهٔ لایه‌ها»:
 * ۱) پوستهٔ هر صفحه هنگام mount یک ورودی نشانگر در history مرورگر می‌گذارد
 *    (pushState با همان URL). Next.js خود __NA و درخت داخلی را داخل state
 *    ورودی کپی می‌کند (window.history.pushState در Next ۱۶ پچ است) پس
 *    برگشت روی این ورودی بدون reload و بدون خروج از route قابل هندل است.
 * ۲) هر لایهٔ قابل‌بستنِ رندر (مودال، پنل، بخش جزئیات، تب) با useBackHandler
 *    خودش را ثبت می‌کند: اگر برگشت بیاید و لایه‌ای باز باشد، بالاترین لایه
 *    بسته می‌شود و نشانگر دوباره گذاشته می‌شود (برگشت مصرف شد).
 * ۳) اگر هیچ لایه‌ای مصرف نکرد (ریشهٔ صفحه): هشدار «برای خروج دوباره
 *    برگشت را بزنید» نمایش داده می‌شود؛ زدن دوباره در پنجرهٔ ~۲.۵ ثانیه
 *    خروج واقعی را آزاد می‌کند (این بار نشانگر دوباره گذاشته نمی‌شود تا
 *    برگشتِ مرورگر روی history واقعی اجرا شود).
 *
 * نکتهٔ سازگاری با Next.js: از window.history.pushStateِ پچ‌شدهٔ Next استفاده
 * می‌کنیم (نه ذخیرهٔ نسخهٔ خام) تا ورودی‌های نشانگر قابل traverse بمانند و
 * هیچ reload اتفاق نیفتد؛ همان الگویی که Next برای pushState بیرونی پشتیبانی
 * می‌کند. دکمهٔ برگشتِ Next (روت‌های واقعی مثل /admin → /mobile) دست‌نخورده
 * کار می‌کند چون ورودی‌های Next در تاریخ باقی می‌مانند.
 */

export type BackHandler = () => boolean;

type Registration = { id: number; priority: number; fn: BackHandler };

/** ثبت‌ها — id صعودی؛ اولویت بالاتر = لایهٔ عمیق‌تر (مودال‌ها) */
const registrations: Registration[] = [];
let nextId = 1;
/** آخرین لحظهٔ نمایش هشدار خروج */
let lastHintAt = 0;
/** callback هشدار خروج که ریشهٔ گارد (پوسته) می‌دهد */
let hintCallback: ((visible: boolean) => void) | null = null;
/** جلسه ۵۴ — خروج واقعی در جریان است: تا خروج کامل، گارد ساکت است.
 *  چون بعد از login از replace استفاده شده، ورودی زیرِ نشانگر خودِ همین
 *  صفحه است؛ برای «خروج واقعی» باید یک back دیگر زده شود (گارد خودش
 *  می‌زند و رویداد بعدی را دیگر مصرف نمی‌کند). */
let exiting = false;

/** گذاشتن ورودی نشانگر در history — کل state فعلیِ Next (شامل __NA و درخت
 *  داخلی) کپی می‌شود داخل نشانگر؛ چون data.__NA ست است، pushStateِ پچ‌شدهٔ
 *  Next آن را دست‌نخورده رد می‌کند (بدون restore) پس state نشانگر بعداً
 *  توسط HistoryUpdater بازنویسی نمی‌شود و ورودی بدون reload قابل handle است */
function pushMarker() {
  const st = window.history.state;
  if (st && typeof st === "object" && st.__NA === true) {
    window.history.pushState({ ...st, __famBackGuard: true }, "", window.location.href);
  } else {
    // state غیر-Next (نباید روی صفحهٔ Next رخ دهد): از مسیر پچ‌شده استفاده
    // می‌کنیم تا فیلدهای داخلی کپی شوند
    window.history.pushState({ __famBackGuard: true }, "", window.location.href);
  }
}

/** رویداد برگشت — از عمیق‌ترین لایه به بیرون مصرف می‌شود */
function handlePop() {
  // خروج واقعی در جریان است — رویدادهای history دیگر مصرف نمی‌شوند تا برگشت
  // مرورگر روی history واقعی اجرا شود (خروج از برنامه)
  if (exiting) return;
  // بالاترین اولویت اول؛ در تساوی، آخرین ثبت‌شده (تازه‌ترین لایه) اول
  const ordered = [...registrations].sort(
    (a, b) => b.priority - a.priority || b.id - a.id,
  );
  for (const reg of ordered) {
    try {
      if (reg.fn()) {
        // لایه‌ای بسته شد — برگشت مصرف شد؛ نشانگر را دوباره می‌گذاریم
        pushMarker();
        return;
      }
    } catch {
      // هندلر معیوب نباید جریان برگشت را بشکند؛ بقیه امتحان می‌شوند
    }
  }
  // هیچ لایه‌ای مصرف نکرد → ریشهٔ صفحه: هشدار خروج (خروج واقعی = دوباره زدن)
  const now = Date.now();
  if (now - lastHintAt <= 2500) {
    // خروج واقعی: گارد ساکت می‌شود و خودش از ورودیِ خودِ اپ هم عبور می‌کند
    // (ورودی زیر نشانگر همین صفحه است چون login با replace آمده بود)
    exiting = true;
    window.history.back();
    return;
  }
  lastHintAt = now;
  hintCallback?.(true);
  pushMarker();
}

/**
 * ریشهٔ گارد — فقط در پوستهٔ هر صفحه (نه داخل کامپوننت‌های تعبیه‌شده).
 * enabled=false یعنی این صفحه ریشهٔ گارد نیست (مثلاً DashboardView حالت
 * embedded داخل پوستهٔ /mobile — آنجا خود پوسته ریشه است).
 */
export function useBackGuardRoot(onHint: (visible: boolean) => void, enabled = true) {
  const hintRef = useRef(onHint);
  // به‌روزرسانی ref فقط داخل effect (قانون react-hooks/refs)
  useEffect(() => {
    hintRef.current = onHint;
  });

  useEffect(() => {
    if (!enabled) return;
    // ورود/بازگشت به این صفحه: هر خروج در جریان ریست می‌شود
    exiting = false;
    hintCallback = (v) => hintRef.current(v);
    // اگر ورودی فعلی تاریخ از قبل نشانگر خود ماست (مثل رفرش صفحه یا برگشت
    // از روت دیگر به همین ورودی) دوباره نشانگر نمی‌گذاریم — فقط listen می‌کنیم
    const st = window.history.state as { __famBackGuard?: boolean } | null;
    if (!st || !st.__famBackGuard) {
      pushMarker();
    }
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
    };
  }, [enabled]);
}

/**
 * ثبت لایهٔ قابل‌بستن — برگشتِ گوشی اول از این لایه‌ها مصرف می‌شود.
 * hndler true برگرداند یعنی «مصرف شد» (مثلاً مودالش بسته شد).
 * اولویت‌ها: ۲ = مودال/پنل؛ ۱ = کارت جزئیات داخل صفحه؛ ۰ = سطح تب پوسته.
 */
export function useBackHandler(fn: BackHandler, priority = 0) {
  const fnRef = useRef(fn);
  // به‌روزرسانی ref فقط داخل effect (قانون react-hooks/refs) — کلوژر تازه
  // بدون ثبت دوبارهٔ لایه در هر رندر
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    const id = nextId++;
    registrations.push({ id, priority, fn: () => fnRef.current() });
    return () => {
      const i = registrations.findIndex((r) => r.id === id);
      if (i >= 0) registrations.splice(i, 1);
    };
  }, [priority]);
}
