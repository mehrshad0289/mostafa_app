"use client";

import { useEffect, useState } from "react";
import ClayIcon from "./ClayIcon";

/* فرمت‌کننده‌ها یک‌بار در سطح ماژول ساخته می‌شوند:
   روز هفته + تاریخ شمسی (تقویم Persian مرورگر) + ساعت زنده */
const WEEKDAY_FMT = new Intl.DateTimeFormat("fa-IR", { weekday: "long" });
const JALALI_DATE_FMT = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type LiveClockProps = {
  className?: string;
};

/**
 * روز، تاریخ شمسی و ساعت زنده — هر ثانیه به‌روز می‌شود (درخواست جلسه ۲۷،
 * هر دو لایه یوزر و ادمین). تا قبل از mount جعبه‌خالی نمایش داده می‌شود تا
 * با رندر سرور هم‌خوان بماند (بدون خطای هیدریشن).
 */
export default function LiveClock({ className = "" }: LiveClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // فراخوانی غیرهمزمان — سازگار با قانون react-hooks/set-state-in-effect
    const tick = () => setNow(new Date());
    const kickoff = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 text-[10.5px] leading-4 text-zinc-500 dark:text-zinc-400 ${className}`}
      role="timer"
      aria-label="روز، تاریخ و ساعت به‌صورت زنده"
    >
      <ClayIcon name="clock" size={15} ghost ghostColor="currentColor" className="shrink-0" />
      <span suppressHydrationWarning>
        {now ? `${WEEKDAY_FMT.format(now)} ${JALALI_DATE_FMT.format(now)} • ${TIME_FMT.format(now)}` : "…"}
      </span>
    </span>
  );
}
