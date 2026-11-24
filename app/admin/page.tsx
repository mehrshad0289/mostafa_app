"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import type { BankMember } from "@/lib/db";
import type { PublicUser } from "@/lib/db";

/** نمای کلی پنل ادمین: شمارش کاربران و اعضای صندوق + لینک‌های سریع */
export default function AdminOverviewPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [members, setMembers] = useState<BankMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/bank/members").then((r) => r.json()),
      ])
        .then(([u, m]) => {
          setUsers(Array.isArray(u.users) ? u.users : []);
          setMembers(Array.isArray(m) ? m : []);
        })
        .catch(() => undefined)
        .finally(() => setLoaded(true));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const cards = [
    { label: "کاربران", value: loaded ? users.length : null, href: "/admin/users" },
    { label: "اعضای صندوق", value: loaded ? members.length : null, href: "/bank?tab=members" },
    {
      label: "کاربران غیرفعال",
      value: loaded ? users.filter((u) => !u.active).length : null,
      href: "/admin/users",
    },
  ];

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            >
              <p className="text-xs text-zinc-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {card.value === null ? "…" : card.value.toLocaleString("fa-IR")}
              </p>
            </Link>
          ))}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p>
            از منوی کناری (یا منوی بالای صفحه در موبایل) می‌توانید بخش‌های
            <strong> اعضا، واریزی‌ها، وام‌ها و اقساط، گزارش‌ها، تنظیمات و سوابق </strong>
            صندوق را باز کنید و در بخش
            <strong> مدیریت کاربران </strong>
            حساب‌های ورود اعضا و ادمین‌ها را بسازید.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            یادآوری: اگر هنوز رمز پیش‌فرض ادمین را عوض نکرده‌اید، از صفحه پروفایل
            خودتان (بخش مدیریت کاربران → تغییر رمز) آن را تغییر دهید.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
