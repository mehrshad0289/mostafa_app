"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import type { BankMember } from "@/lib/db";
import type { PublicUser } from "@/lib/db";

/** نمای کلی پنل ادمین: شمارش کاربران و اعضای بانک + هشدار وضعیت ذخیره‌سازی + لینک‌های سریع */
export default function AdminOverviewPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [members, setMembers] = useState<BankMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState<"kv" | "file" | "unknown">("unknown");

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/bank/members").then((r) => r.json()),
        fetch("/api/admin/storage-status").then((r) =>
          r.ok ? r.json() : { mode: "unknown" },
        ),
      ])
        .then(([u, m, s]) => {
          setUsers(Array.isArray(u.users) ? u.users : []);
          setMembers(Array.isArray(m) ? m : []);
          const mode = (s as { mode?: string }).mode;
          setStorage(mode === "kv" || mode === "file" ? mode : "unknown");
        })
        .catch(() => undefined)
        .finally(() => setLoaded(true));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const cards = [
    { label: "کاربران", value: loaded ? users.length : null, href: "/admin/users" },
    { label: "اعضای بانک", value: loaded ? members.length : null, href: "/bank?tab=members" },
    {
      label: "کاربران غیرفعال",
      value: loaded ? users.filter((u) => !u.active).length : null,
      href: "/admin/users",
    },
  ];

  return (
    <AdminShell>
      <div className="space-y-6">
        {storage === "file" && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm leading-7 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <strong>هشدار مهم: ذخیره‌سازی دائمی فعال نیست.</strong> داده‌ها الان در
            فایل موقت سرور نگه‌داری می‌شود؛ هر بار که سرور ورکل سرد شود همه اعضا،
            کاربران و اطلاعات ثبت‌شده پاک می‌شوند و اعضا نمی‌توانند وارد شوند. برای
            رفع: در داشبورد Vercel تب <strong>Storage</strong> یک دیتابیس
            <strong> KV </strong>بسازید و به همین پروژه وصل کنید و یک بار
            <strong> Redeploy </strong>بزنید.
          </div>
        )}
        {storage === "kv" && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            ذخیره‌سازی دائمی (KV) فعال است؛ داده‌ها با سرد شدن سرور پاک نمی‌شوند.
          </div>
        )}
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
            بانک را باز کنید و در بخش
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
