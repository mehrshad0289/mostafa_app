"use client";

import { useEffect, useRef } from "react";

/**
 * جلسه ۳۹ — ناوبری کشویی (swipe) بین صفحات و بخش‌ها.
 *
 * کاربر به درخواستش گفت «صفحات به صورت کشویی هم کار کنند؛ نیازی نباشد حتماً
 * سر بخش‌ها را تاچ کنید» — این هوک ژست افقی لمس را تشخیص می‌دهد و به جای لمس
 * مربع/تب، مالیدن انگشت به راست/چپ همان کار را انجام می‌دهد.
 *
 * جهت‌ها RTL هستند (کل اپ فارسی راست‌به‌چپ است): صفحهٔ «بعدی» سمت چپ است،
 * پس کشیدن انگشت به راست (dx > 0) = بعدی و کشیدن به چپ (dx < 0) = قبلی —
 * مثل ورق زدن کتاب فارسی.
 *
 * طراحی ضدتداخل:
 * - اسکرول عمودی مختل نمی‌شود: فقط وقتی ژست «عمدتاً افقی» باشد (|dx| بزرگ‌تر
 *   از آستانه و چند برابر |dy|) سوایپ حساب می‌شود؛ در حین move اگر حرکت عمودی
 *   غلبه کند، کاندیدای سوایپ لغو می‌شود. هیچ‌جا preventDefault در مسیر اسکرول
 *   زده نمی‌شود.
 * - سوایپ داخل مودال‌ها/نوارهای اسکرول افقی با data-swipe-ignore نادیده گرفته
 *   می‌شود (باید روی ریشهٔ آن مودال/نوار گذاشته شود).
 * - اگر گزینهٔ stopPropagation روشن باشد (لایه‌های تو در تو: داشبورد عضو داخل
 *   پوسته موبایل)، سوایپِ تشخیص‌داده‌شده به هندلر والد هم نمی‌رسد تا یک سوایپ
 *   دو صفحه را جلو نزند؛ preventDefault هم کلیکِ بعد از سوایپ روی دکمه‌ها را
 *   خنثی می‌کند.
 */

type SwipeNavHandlers = {
  /** کشیدن انگشت به راست (RTL = صفحهٔ بعدی) */
  onSwipeNext?: () => void;
  /** کشیدن انگشت به چپ (RTL = صفحهٔ قبلی) */
  onSwipePrev?: () => void;
};

type SwipeNavOptions = {
  /** سوایپ تشخیص‌داده‌شده به هندلر والد DOM هم منتقل نشود (لایهٔ تو در تو) */
  stopPropagation?: boolean;
};

/** کمترین جابه‌جایی افقی (px) که سوایپ حساب می‌شود */
const SWIPE_MIN_PX = 55;
/** ژست باید عمدتاً افقی باشد: |dx| حداقل این ضریب از |dy| بزرگ‌تر */
const SWIPE_AXIS_RATIO = 1.4;
/** حداکثر مدت ژست (ms) — لمس‌های طولانی/نگه‌داشتن سوایپ نیستند */
const SWIPE_MAX_MS = 1200;

type SwipeStart = { x: number; y: number; t: number } | null;

export function useSwipeNav(handlers: SwipeNavHandlers, options: SwipeNavOptions = {}) {
  /** آخرین هندلرها/گزینه‌ها در ref نگه داشته می‌شوند تا تابع‌های تاچ در هر
   *  رندر بازسازی نشوند؛ به‌روزرسانی داخل effect است نه هنگام رندر
   *  (قانون react-hooks/refs) */
  const handlersRef = useRef(handlers);
  const optionsRef = useRef(options);
  useEffect(() => {
    handlersRef.current = handlers;
    optionsRef.current = options;
  });
  const start = useRef<SwipeStart>(null);

  function onTouchStart(e: React.TouchEvent) {
    // چند انگشت (پینچ/زوم) سوایپ نیست
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    // داخل مودال/اسکرول افقی/فیلد فرم؟ سوایپ ناوبری نباید تریگر شود
    if (target?.closest?.("[data-swipe-ignore]")) {
      start.current = null;
      return;
    }
    if (target?.closest?.("input, textarea, select")) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    if (!t) {
      start.current = null;
      return;
    }
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current;
    if (!s) return;
    // پینچ وسط ژست → لغو
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // اگر حرکت عمودی غلبه کرد یعنی اسکرول است، نه سوایپ — کاندیدا را لغو کن
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * SWIPE_AXIS_RATIO) {
      start.current = null;
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Date.now() - s.t;
    if (dt > SWIPE_MAX_MS) return;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;

    // ژست افقی معتبر: کلیکِ مصنوعی بعد از سوایپ روی دکمه‌ها خنثی شود
    e.preventDefault();
    if (optionsRef.current.stopPropagation) e.stopPropagation();

    // RTL: راست = بعدی، چپ = قبلی (ورق زدن کتاب فارسی)
    if (dx > 0) handlersRef.current.onSwipeNext?.();
    else handlersRef.current.onSwipePrev?.();
  }

  function onTouchCancel() {
    start.current = null;
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
