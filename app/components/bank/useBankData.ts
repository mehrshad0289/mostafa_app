"use client";

import { useCallback, useEffect, useState } from "react";
import type { BankDeposit, BankLoan, BankMember, BankSettings } from "@/lib/db";

/**
 * هوک مشترک داده‌های بانک — صفحه‌های مستقل هر بخش (/bank/members و…)
 * همه با همین هوک اعضا/تراکنش‌ها/وام‌ها/تنظیمات را لود می‌کنند (جلسه ۲۷).
 * منطق load عیناً از صفحه قبلی /bank منتقل شده است.
 */
export function useBankData() {
  const [members, setMembers] = useState<BankMember[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [settings, setSettings] = useState<BankSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = (await fetch("/api/bank/members").then((r) => r.json())) as BankMember[];
      const d = (await fetch("/api/bank/deposits").then((r) => r.json())) as BankDeposit[];
      const l = (await fetch("/api/bank/loans").then((r) => r.json())) as BankLoan[];
      const s = (await fetch("/api/bank/settings").then((r) => r.json())) as BankSettings;
      setMembers(Array.isArray(m) ? m : []);
      setDeposits(Array.isArray(d) ? d : []);
      setLoans(Array.isArray(l) ? l : []);
      setSettings(s && typeof s === "object" ? s : null);
    } catch {
      setError("دریافت اطلاعات بانک ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // فراخوانی غیرهمزمان — سازگار با قانون react-hooks/set-state-in-effect
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { members, deposits, loans, settings, loading, error, load };
}
