"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import type { BankMember, PublicUser } from "@/lib/db";

type UserRow = PublicUser;
type Role = "admin" | "member";

/** رمز تصادفی امن بدون نویسه‌های گیج‌کننده (0/O/1/l) — در event handler فقط */
function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join("");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2.5 text-sm dark:border-zinc-800";
const btnPrimary =
  "rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white";
const btnGhost =
  "rounded-xl border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700";
const btnDanger =
  "rounded-xl border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [members, setMembers] = useState<BankMember[]>([]);
  const [me, setMe] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [fUsername, setFUsername] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fFullName, setFFullName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fRole, setFRole] = useState<Role>("member");
  const [fMemberId, setFMemberId] = useState("");
  const [busy, setBusy] = useState(false);

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eRole, setERole] = useState<Role>("member");
  const [eMemberId, setEMemberId] = useState("");

  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [delUser, setDelUser] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, m, meRes] = await Promise.all([
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
        fetch("/api/bank/members").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
      ]);
      setUsers(Array.isArray(u.users) ? u.users : []);
      setMembers(Array.isArray(m) ? m : []);
      setMe((meRes.user as UserRow | null) ?? null);
    } catch {
      setError("دریافت فهرست کاربران ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setFUsername("");
    setFPassword(randomPassword());
    setFFullName("");
    setFPhone("");
    setFRole("member");
    setFMemberId("");
    setError("");
    setNotice("");
    setShowCreate(true);
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fUsername,
          password: fPassword,
          fullName: fFullName,
          phone: fPhone,
          role: fRole,
          memberId: fRole === "member" && fMemberId ? fMemberId : null,
        }),
      });
      const data = (await response.json()) as { user?: UserRow; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error || "ساخت کاربر ناموفق بود.");
        return;
      }
      setShowCreate(false);
      setNotice(`کاربر «${data.user.username}» ساخته شد. رمز او را یادداشت کنید.`);
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(user: UserRow) {
    setEditUser(user);
    setEFullName(user.fullName);
    setEPhone(user.phone);
    setERole(user.role);
    setEMemberId(user.memberId ?? "");
    setError("");
    setNotice("");
  }

  async function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editUser) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: eFullName,
          phone: ePhone,
          role: eRole,
          memberId: eRole === "member" && eMemberId ? eMemberId : null,
        }),
      });
      const data = (await response.json()) as { user?: UserRow; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error || "ویرایش کاربر ناموفق بود.");
        return;
      }
      setEditUser(null);
      setNotice("اطلاعات کاربر ذخیره شد.");
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!pwUser) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${pwUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "تغییر رمز ناموفق بود.");
        return;
      }
      setNotice(`رمز «${pwUser.username}» عوض شد. رمز جدید را به او بگویید.`);
      setPwUser(null);
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  /** فعال/غیرفعال کردن حساب با اندپوینت اختصاصی؛ ادمین خودش را نمی‌تواند غیرفعال کند */
  async function toggleActive(user: UserRow) {
    if (me && user.id === me.id && user.active) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/${user.active ? "deactivate" : "activate"}`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "تغییر وضعیت ناموفق بود.");
        return;
      }
      setNotice(user.active ? `کاربر «${user.username}» غیرفعال شد.` : `کاربر «${user.username}» فعال شد.`);
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  /** روشن/خاموش کردن «ورود با رمز» با اندپوینت اختصاصی؛ ادمین خودش را نمی‌تواند ببندد */
  async function togglePasswordLogin(user: UserRow) {
    if (me && user.id === me.id && user.passwordLoginEnabled) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/${user.passwordLoginEnabled ? "disable-password-login" : "enable-password-login"}`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "تغییر وضعیت ورود با رمز ناموفق بود.");
        return;
      }
      setNotice(
        user.passwordLoginEnabled
          ? `ورود با رمز «${user.username}» غیرفعال شد.`
          : `ورود با رمز «${user.username}» فعال شد.`,
      );
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  /** حذف کامل کاربر با اندپوینت DELETE؛ حساب خودتان و آخرین ادمین در سرور گارد می‌شوند */
  async function submitDelete() {
    if (!delUser) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${delUser.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "حذف کاربر ناموفق بود.");
        return;
      }
      setNotice(`کاربر «${delUser.username}» و همه نشست‌های او حذف شد.`);
      setDelUser(null);
      await load();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.name ?? "—") : "—";

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">مدیریت کاربران</h2>
            <p className="text-xs text-zinc-500">
              ساخت حساب ورود برای ادمین‌ها و اعضای بانک
            </p>
          </div>
          <button type="button" onClick={openCreate} className={btnPrimary}>
            ساخت کاربر جدید
          </button>
        </div>

        {notice && (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {error && !showCreate && !editUser && !pwUser && !delUser && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">نام کاربری</th>
                <th className="px-4 py-3 font-medium">نام کامل</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">ورود با رمز</th>
                <th className="px-4 py-3 font-medium">عضو بانک</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    در حال دریافت…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    هنوز کاربری ساخته نشده است.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {user.username}
                    </td>
                    <td className="px-4 py-3">{user.fullName || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs ${
                          user.role === "admin"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
                        }`}
                      >
                        {user.role === "admin" ? "ادمین" : "عضو"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs ${
                          user.active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                        }`}
                      >
                        {user.active ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs ${
                          user.passwordLoginEnabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {user.passwordLoginEnabled ? "مجاز" : "غیرمجاز"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{memberName(user.memberId)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(user)} className={btnGhost}>
                          ویرایش
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPwUser(user);
                            setPwValue(randomPassword());
                            setError("");
                            setNotice("");
                          }}
                          className={btnGhost}
                        >
                          ریست رمز
                        </button>
                        <button
                          type="button"
                          disabled={busy || (me ? user.id === me.id && user.active : false)}
                          onClick={() => toggleActive(user)}
                          className={btnGhost}
                          title={
                            me && user.id === me.id
                              ? "حساب خودتان را نمی‌توانید غیرفعال کنید"
                              : undefined
                          }
                        >
                          {user.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                        <button
                          type="button"
                          disabled={
                            busy || (me ? user.id === me.id && user.passwordLoginEnabled : false)
                          }
                          onClick={() => togglePasswordLogin(user)}
                          className={btnGhost}
                          title={
                            me && user.id === me.id
                              ? "ورود با رمز خودتان را نمی‌توانید غیرفعال کنید"
                              : undefined
                          }
                        >
                          {user.passwordLoginEnabled ? "بستن ورود با رمز" : "بازکردن ورود با رمز"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || (me ? user.id === me.id : false)}
                          onClick={() => {
                            setDelUser(user);
                            setError("");
                            setNotice("");
                          }}
                          className={btnDanger}
                          title={
                            me && user.id === me.id
                              ? "حساب خودتان را نمی‌توانید حذف کنید"
                              : undefined
                          }
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title="ساخت کاربر جدید" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-3">
            <Field label="نام کاربری">
              <input
                value={fUsername}
                onChange={(e) => setFUsername(e.target.value)}
                dir="ltr"
                className={`${inputClass} text-left`}
                required
              />
            </Field>
            <Field label="رمز عبور">
              <div className="flex gap-2">
                <input
                  value={fPassword}
                  onChange={(e) => setFPassword(e.target.value)}
                  dir="ltr"
                  className={`${inputClass} text-left font-mono`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setFPassword(randomPassword())}
                  className={btnGhost}
                  title="تولید رمز تصادفی"
                >
                  تولید
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setNotice((await copyText(fPassword)) ? "رمز کپی شد." : "کپی ناموفق بود.");
                  }}
                  className={btnGhost}
                >
                  کپی
                </button>
              </div>
            </Field>
            <Field label="نام و نام خانوادگی">
              <input value={fFullName} onChange={(e) => setFFullName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="شماره تلفن">
              <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className={inputClass} />
            </Field>
            <Field label="نقش">
              <select
                value={fRole}
                onChange={(e) => setFRole(e.target.value === "admin" ? "admin" : "member")}
                className={inputClass}
              >
                <option value="member">عضو</option>
                <option value="admin">ادمین</option>
              </select>
            </Field>
            {fRole === "member" && (
              <Field label="اتصال به عضو بانک">
                <select value={fMemberId} onChange={(e) => setFMemberId(e.target.value)} className={inputClass}>
                  <option value="">— بدون اتصال —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "در حال ذخیره…" : "ساخت کاربر"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal title={`ویرایش کاربر «${editUser.username}»`} onClose={() => setEditUser(null)}>
          <form onSubmit={submitEdit} className="space-y-3">
            <Field label="نام و نام خانوادگی">
              <input value={eFullName} onChange={(e) => setEFullName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="شماره تلفن">
              <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} className={inputClass} />
            </Field>
            <Field label="نقش">
              <select
                value={eRole}
                onChange={(e) => setERole(e.target.value === "admin" ? "admin" : "member")}
                className={inputClass}
              >
                <option value="member">عضو</option>
                <option value="admin">ادمین</option>
              </select>
            </Field>
            {eRole === "member" && (
              <Field label="اتصال به عضو بانک">
                <select value={eMemberId} onChange={(e) => setEMemberId(e.target.value)} className={inputClass}>
                  <option value="">— بدون اتصال —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "در حال ذخیره…" : "ذخیره"}
              </button>
              <button type="button" onClick={() => setEditUser(null)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pwUser && (
        <Modal title={`ریست رمز «${pwUser.username}»`} onClose={() => setPwUser(null)}>
          <form onSubmit={submitPassword} className="space-y-3">
            <Field label="رمز عبور جدید">
              <div className="flex gap-2">
                <input
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  dir="ltr"
                  className={`${inputClass} text-left font-mono`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setPwValue(randomPassword())}
                  className={btnGhost}
                >
                  تولید
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setNotice((await copyText(pwValue)) ? "رمز کپی شد." : "کپی ناموفق بود.");
                  }}
                  className={btnGhost}
                >
                  کپی
                </button>
              </div>
            </Field>
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "در حال ذخیره…" : "ذخیره رمز"}
              </button>
              <button type="button" onClick={() => setPwUser(null)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </form>
        </Modal>
      )}
      {delUser && (
        <Modal title={`حذف کاربر «${delUser.username}»`} onClose={() => setDelUser(null)}>
          <div className="space-y-3">
            <p className="text-sm leading-7">
              حساب <strong dir="ltr">{delUser.username}</strong> و همه نشست‌های او برای همیشه
              حذف می‌شود و دیگر نمی‌تواند وارد شود.
              {delUser.memberId
                ? " عضو بانک متصل به این حساب حذف نمی‌شود و اطلاعات مالی او باقی می‌ماند."
                : ""}
            </p>
            <ModalError error={error} />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitDelete()}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "در حال حذف…" : "حذف کاربر"}
              </button>
              <button type="button" onClick={() => setDelUser(null)} className={btnGhost}>
                انصراف
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-zinc-500">
      {label}
      {children}
    </label>
  );
}

function ModalError({ error }: { error: string }) {
  if (!error) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
}
