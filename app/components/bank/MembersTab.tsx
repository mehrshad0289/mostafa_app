"use client";

import { useMemo, useState } from "react";
import {
  memberDebt,
  memberShareDue,
  monthKey,
  normalizeDigits,
  normalizeSearchText,
} from "@/lib/bank";
import type { BankDeposit, BankLoan, BankMember } from "@/lib/db";
import MemberDetail from "./MemberDetail";
import { useHydrated } from "./useHydrated";
import { downloadCsv } from "./csv";

type MembersTabProps = {
  members: BankMember[];
  deposits: BankDeposit[];
  loans: BankLoan[];
  amountPerShare: number;
  onRefresh: () => void;
};

type MemberFormState = {
  name: string;
  shares: string;
  phone: string;
  gender: "male" | "female";
  note: string;
};

const EMPTY_FORM: MemberFormState = {
  name: "",
  shares: "1",
  phone: "",
  gender: "male",
  note: "",
};

function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

function toMoney(value: number): string {
  return `${faNum(Math.round(value))} تومان`;
}

const jalaliDateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
});

function faDate(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return jalaliDateFmt.format(date);
}

type MemberRow = {
  member: BankMember;
  /** محاسبات تعهد — فقط پس از hydration پر می‌شود */
  due: ReturnType<typeof memberShareDue> | null;
  debt: number | null;
};

export default function MembersTab({
  members,
  deposits,
  loans,
  amountPerShare,
  onRefresh,
}: MembersTabProps) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MemberFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BankMember | null>(null);
  const [quickPayId, setQuickPayId] = useState<string | null>(null);
  /** عضو انتخاب‌شده برای پرونده مالی (استپ ۱۲) */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    if (!hydrated) return [];
    const now = new Date();
    return members.map((member) => ({
      member,
      due: memberShareDue(member, deposits, amountPerShare, now),
      debt: memberDebt(member, deposits, loans, amountPerShare, now),
    }));
  }, [members, deposits, loans, amountPerShare, hydrated]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return rows;
    return rows.filter(({ member }) =>
      normalizeSearchText(`${member.name} ${member.phone}`).includes(q),
    );
  }, [rows, query]);

  const detailMember = detailId
    ? (members.find((m) => m.id === detailId) ?? null)
    : null;

  function openAdd() {
    setFormOpen(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function openEdit(member: BankMember) {
    setFormOpen(true);
    setEditingId(member.id);
    setForm({
      name: member.name,
      shares: String(member.shares),
      phone: member.phone,
      gender: member.gender,
      note: member.note,
    });
    setError("");
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/bank/members/${editingId}` : "/api/bank/members",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            shares: Number(normalizeDigits(form.shares)),
            phone: form.phone.trim(),
            gender: form.gender,
            note: form.note.trim(),
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت عضو ناموفق بود.");
        return;
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bank/members/${deleting.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "حذف عضو ناموفق بود.");
        return;
      }
      setDeleting(null);
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  /** پرداخت سریع سهم ماهانه: ثبت یک‌جای تعهد ماه جاری از کارت عضو */
  async function quickPayShare(member: BankMember, monthlyDue: number) {
    setQuickPayId(member.id);
    setError("");
    try {
      const response = await fetch("/api/bank/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "share",
          memberId: member.id,
          memberName: member.name,
          title: "سهم ماهانه",
          amount: monthlyDue,
          periodKey: monthKey(new Date()),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "ثبت سهم ماهانه ناموفق بود.");
        return;
      }
      onRefresh();
    } catch {
      setError("ارتباط با سرور ناموفق بود.");
    } finally {
      setQuickPayId(null);
    }
  }

  function cardTone(row: MemberRow): string {
    if (row.member.settled) return "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900";
    if (row.due?.overdue)
      return "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40";
    return "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  }

  function nameTone(row: MemberRow): string {
    if (row.member.settled) {
      const net = row.member.settlementNet;
      if (net != null && net < 0) return "line-through text-amber-700 dark:text-amber-400";
      return "line-through text-emerald-700 dark:text-emerald-400";
    }
    return "";
  }

  const inputClass =
    "rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام یا تلفن…"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          افزودن عضو
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "اعضا",
              [
                "نام",
                "تلفن",
                "جنسیت",
                "تعداد سهم",
                "تاریخ عضویت",
                "اعتبار (جمع واریزی سهام)",
                "بدهی کل",
              ],
              filtered.map(({ member }) => {
                const now = new Date();
                const due = memberShareDue(member, deposits, amountPerShare, now);
                const debt = memberDebt(member, deposits, loans, amountPerShare, now);
                return [
                  member.name,
                  member.phone || "—",
                  member.gender === "female" ? "زن" : "مرد",
                  member.shares,
                  member.createdAt ? faDate(member.createdAt) : "—",
                  due.credit,
                  debt,
                ];
              }),
            )
          }
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          خروجی CSV
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {detailMember ? (
        <MemberDetail
          member={detailMember}
          deposits={deposits}
          loans={loans}
          amountPerShare={amountPerShare}
          onBack={() => setDetailId(null)}
          onRefresh={onRefresh}
        />
      ) : (
        <>
      {formOpen && (
        <form
          onSubmit={submitForm}
          className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-sm font-medium">
            {editingId ? "ویرایش عضو" : "افزودن عضو"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-500">
              نام *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              تعداد سهم *
              <input
                type="number"
                min={1}
                step={1}
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                required
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              تلفن
              <input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-500">
              جنسیت
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value as "male" | "female" })
                }
                className={`${inputClass} w-full`}
              >
                <option value="male">مرد</option>
                <option value="female">زن</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs text-zinc-500">
            یادداشت
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={`${inputClass} w-full`}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {editingId ? "ذخیره" : "ثبت عضو"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              >
                انصراف
              </button>
            )}
          </div>
        </form>
      )}

      {deleting && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p>
            عضو «{deleting.name}» حذف شود؟ واریزی‌ها و وام‌های ثبت‌شده او در
            فهرست‌ها با نام همان لحظه باقی می‌مانند.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              بله، حذف
            </button>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        {faNum(filtered.length)} از {faNum(members.length)} عضو
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {members.length === 0
            ? "هنوز عضوی ثبت نشده است؛ با «افزودن عضو» شروع کنید."
            : "عضویی مطابق جست‌وجو پیدا نشد."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => {
            const { member, due, debt } = row;
            const net =
              member.settlementNet ??
              (due && debt != null ? due.credit - debt : null);
            return (
              <li
                key={member.id}
                className={`rounded-2xl border p-4 shadow-sm ${cardTone(row)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className={`text-base font-medium ${nameTone(row)}`}>
                      {member.name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {member.phone ? (
                        <span dir="ltr">{member.phone}</span>
                      ) : (
                        "بدون تلفن"
                      )}
                      {" · "}
                      {faNum(member.shares)} سهم
                      {member.settled && " · تسویه‌شده"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailId(member.id)}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
                    >
                      پرونده مالی
                    </button>
                    <button
                      type="button"
                      onClick={() => void quickPayShare(member, due!.monthlyDue)}
                      disabled={
                        !due ||
                        due.monthlyDue <= 0 ||
                        member.settled ||
                        quickPayId === member.id
                      }
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {quickPayId === member.id ? "در حال ثبت…" : "پرداخت سهم ماهانه"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(member)}
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 dark:border-red-900 dark:text-red-400"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                {due && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] text-zinc-500">
                        اعتبار (جمع واریزی سهام)
                      </dt>
                      <dd className="font-semibold">{toMoney(due.credit)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">مانده تعهد ماه جاری</dt>
                      <dd className={due.left > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {toMoney(due.left)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">بدهی کل (تعهد + وام)</dt>
                      <dd>{debt != null ? toMoney(debt) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">تعهد ماهانه</dt>
                      <dd>{toMoney(due.monthlyDue)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">مانده خالص</dt>
                      <dd className={net != null && net < 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>
                        {net != null ? toMoney(net) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">وضعیت تسویه</dt>
                      <dd>
                        {member.settled ? "تسویه‌شده" : "در جریان"}
                        {!member.settled && due.overdue && (
                          <span className="mr-1 text-red-600 dark:text-red-400">
                            · عقب‌افتاده
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                )}

                {member.note && (
                  <p className="mt-2 text-xs text-zinc-500">{member.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
