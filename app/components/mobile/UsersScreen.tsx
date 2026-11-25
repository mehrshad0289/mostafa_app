"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ClayIcon, { toneForSeed } from "./ClayIcon";
import { jalaliParts } from "@/lib/bank";
import type { BankMember, PublicUser } from "@/lib/db";

/**
 * اسلاید مدیریت کاربران — برای مدیر: فهرست کاربران با نقش، تلفن و حذف
 * (همان اندپوینت‌های پنل ادمین)؛ برای عضو عادی: کارت دسترسی‌نشدن + خلاصه پروفایل.
 */

function faDate(iso: string): string {
  try {
    const p = jalaliParts(new Date(iso));
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export default function UsersScreen({ me }: { me: PublicUser }) {
  const isAdmin = me.role === "admin";
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [members, setMembers] = useState<BankMember[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const [u, m] = await Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
      ]);
      setUsers(Array.isArray(u.users) ? u.users : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setError("دریافت فهرست کاربران ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // شروع load در تیک بعدی — مثل DashboardView تا setState هم‌زمان در effect نباشد
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const linkedCount = useMemo(() => users.filter((u) => u.memberId).length, [users]);

  async function deleteUser() {
    if (!confirmDelete) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${confirmDelete.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "حذف کاربر ناموفق بود.");
        return;
      }
      setNotice(`کاربر «${confirmDelete.fullName || confirmDelete.username}» حذف شد.`);
      setConfirmDelete(null);
      await load();
    } catch {
      setError("حذف کاربر ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 px-4 pt-4">
        <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="shield" size={54} className="mx-auto" />
          <p className="mt-3 text-sm font-bold">دسترسی محدود</p>
          <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            مدیریت کاربران فقط برای مدیر بانک فعال است.
          </p>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <span
              className="clay"
              style={{
                width: 46,
                height: 46,
                background: `linear-gradient(140deg, ${toneForSeed(me.username)[0]}, ${toneForSeed(me.username)[1]})`,
              }}
            >
              <span className="relative z-10 text-sm font-bold text-white">
                {(me.fullName || me.username).trim().charAt(0)}
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{me.fullName || me.username}</p>
              <p dir="ltr" className="text-right text-[11px] text-zinc-500">
                @{me.username}
              </p>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-dashed border-zinc-200 pt-3 text-xs dark:border-zinc-800">
            <div className="flex justify-between">
              <dt className="text-zinc-500">تلفن</dt>
              <dd dir="ltr">{me.phone || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">تاریخ عضویت</dt>
              <dd>{faDate(me.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pt-4">
      {/* آمار سریع */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "کاربران", value: users.length, icon: "users" as const, tone: ["#C3AEF5", "#8460D6"] as [string, string] },
          { label: "مدیران", value: adminCount, icon: "shield" as const, tone: ["#B0B8F8", "#6568D9"] as [string, string] },
          { label: "متصل به بانک", value: linkedCount, icon: "check" as const, tone: ["#B5EBA5", "#54B854"] as [string, string] },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center gap-1.5 rounded-3xl border border-zinc-200/80 bg-white px-2 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <ClayIcon name={s.icon} tone={s.tone} size={40} />
            <p className="text-base font-black leading-5">{Number(s.value).toLocaleString("fa-IR")}</p>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {loading && <p className="py-6 text-center text-xs text-zinc-500">در حال دریافت کاربران…</p>}

      {/* فهرست کاربران */}
      {!loading &&
        users.map((u) => {
          const member = members.find((m) => m.id === u.memberId);
          const isSelf = u.id === me.id;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span
                className="clay shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: `linear-gradient(140deg, ${toneForSeed(u.username)[0]}, ${toneForSeed(u.username)[1]})`,
                }}
              >
                <span className="relative z-10 text-sm font-bold text-white">
                  {(u.fullName || u.username).trim().charAt(0)}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-bold">
                  {u.fullName || u.username}
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      u.role === "admin"
                        ? "bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {u.role === "admin" ? "مدیر" : "عضو"}
                  </span>
                  {!u.active && (
                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                      غیرفعال
                    </span>
                  )}
                </p>
                <p dir="ltr" className="text-right text-[10.5px] text-zinc-500">
                  @{u.username} {u.phone ? `· ${u.phone}` : ""}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {member ? `متصل به عضویت: ${member.name}` : "بدون اتصال به عضویت بانک"} · {faDate(u.createdAt)}
                </p>
              </div>
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(u)}
                  aria-label={`حذف ${u.username}`}
                  className="clay-press grid size-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                >
                  <ClayIcon name="trash" size={22} tone={["#FCA9A9", "#D95050"]} />
                </button>
              )}
            </div>
          );
        })}

      {!loading && users.length === 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <ClayIcon name="users" size={52} className="mx-auto opacity-90" />
          <p className="mt-3 text-xs text-zinc-500">کاربری ثبت نشده است.</p>
        </div>
      )}

      {/* مودال تأیید حذف */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <ClayIcon name="trash" size={48} tone={["#FCA9A9", "#D95050"]} />
            <h3 className="mt-3 text-sm font-bold">حذف کاربر</h3>
            <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              کاربر «{confirmDelete.fullName || confirmDelete.username}» و همه نشست‌های او حذف می‌شود. این کار بازگشت‌پذیر نیست. ادامه می‌دهید؟
            </p>
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void deleteUser()}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "در حال حذف…" : "حذف قطعی"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(null);
                  setError("");
                }}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
