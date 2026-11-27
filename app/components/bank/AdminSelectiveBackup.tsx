"use client";

import { useState } from "react";
import ClayIcon from "@/app/components/mobile/ClayIcon";

/**
 * پشتیبان‌گیری انتخابی ادمین (جلسه ۴۹ به درخواست کاربر: «تو پنل ادمین هم امکان
 * پشتیبان‌گیری از داده‌ها وجود داشته باشد؛ امکان انتخاب داده پشتیبان‌گیری هم
 * وجود داشته باشد — این امکان را در بخش تنظیمات، بخش پشتیبان‌گیری قرار بده»).
 * ادمین بخش‌های دلخواه را تیک می‌زند و خروجی اکسل (.xls چندبرگهٔ RTL، بدون
 * کتابخانهٔ خارجی) می‌گیرد یا نسخهٔ چاپ/PDF باز می‌کند — همان الگوی
 * BackupSection پنل یوزر، این‌بار برای کل دادهٔ بانک.
 */

type AdminBackupPayload = {
  generatedAt: string;
  members?: {
    name: string;
    shares: number;
    phone: string;
    totalDeposited: number;
    settled: boolean;
    settlementNet: number | null;
    note: string;
    createdAt: string;
  }[];
  deposits?: {
    memberName: string;
    type: string;
    title: string;
    amount: number;
    periodKey: string;
    createdAt: string;
  }[];
  loans?: {
    memberName: string;
    principal: number;
    interestAmount: number;
    totalAmount: number;
    disbursedAmount: number;
    installmentCount: number;
    status: string;
    createdAt: string;
    installments: { number: number; amount: number; dueAt: string; paid: boolean }[];
    payments: { amount: number; paidAt: string; note: string }[];
  }[];
  paymentRequests?: {
    username: string;
    kind: string;
    amount: number;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    installmentNumber: number | null;
  }[];
  loanRequests?: {
    username: string;
    amount: number;
    months: number;
    reason: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  }[];
  loanPayoutAccounts?: { holder: string; cardNumber: string; sheba: string; note: string }[];
  settings?: {
    amountPerShare: number;
    depositTitles: string[];
    duplicateWarning: boolean;
    depositAccounts: { primary: DepositAccountBox; alternate: DepositAccountBox };
  };
  audit?: { at: string; action: string; kind: string; detail: string }[];
};

type DepositAccountBox = { holder: string; cardNumber: string; sheba: string };

const PARTS: { key: keyof typeof LABELS; title: string; hint: string }[] = [
  { key: "members", title: "اعضا", hint: "فهرست اعضا، سهم و وضعیت تسویه" },
  { key: "deposits", title: "واریزی‌ها", hint: "همه تراکنش‌های ثبت‌شده" },
  { key: "loans", title: "وام‌ها و اقساط", hint: "وام‌ها، جدول اقساط و پرداخت‌ها" },
  { key: "requests", title: "درخواست‌ها", hint: "درخواست‌های سهام/قسط/تسهیلات + حساب‌های شبا اعضا" },
  { key: "settings", title: "تنظیمات بانک", hint: "مبلغ سهم، حساب‌های واریز، عنوان‌های آماده" },
  { key: "audit", title: "سوابق", hint: "تاریخچه عملیات روی داده بانک" },
];

const LABELS = {
  members: "اعضا",
  deposits: "واریزی‌ها",
  loans: "وام‌ها و اقساط",
  requests: "درخواست‌ها",
  settings: "تنظیمات بانک",
  audit: "سوابق",
} as const;

type PartKey = keyof typeof LABELS;

const STATUS_FA: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  rejected: "رد شده",
  active: "در جریان",
  paid: "تسویه شده",
  cancelled: "لغو شده",
};

const DEPOSIT_TYPE_FA: Record<string, string> = {
  share: "سهام",
  loan_interest: "سود وام",
  profit: "سود بانک",
  misc: "متفرقه",
  withdraw_misc: "برداشت متفرقه",
};

const KIND_FA: Record<string, string> = {
  share: "پرداخت سهام",
  installment: "پرداخت قسط",
};

function faNum(value: number): string {
  return Number(value || 0).toLocaleString("fa-IR");
}

function faDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(d);
  } catch {
    return iso;
  }
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const htmlEscape = xmlEscape;

function excelRow(cells: (string | number)[], header = false): string {
  const body = cells
    .map((c) =>
      typeof c === "number"
        ? `<Cell${header ? ' ss:StyleID="h"' : ""}><Data ss:Type="Number">${c}</Data></Cell>`
        : `<Cell${header ? ' ss:StyleID="h"' : ""}><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`,
    )
    .join("");
  return `<Row>${body}</Row>`;
}

function excelSheet(name: string, rows: string[]): string {
  return `<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}" ss:RightToLeft="1"><Table>${rows.join("")}</Table></Worksheet>`;
}

function htmlTable(headers: string[], rows: string[][]): string {
  return (
    `<table><thead><tr>${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`
  );
}

/** برگه‌های اکسل بر اساس بخش‌های انتخابی */
function buildSheets(data: AdminBackupPayload, selected: PartKey[]): { name: string; rows: string[] }[] {
  const sheets: { name: string; rows: string[] }[] = [];

  if (selected.includes("members")) {
    const rows = [
      excelRow(["نام", "تعداد سهم", "تلفن", "جمع واریزی‌ها (تومان)", "وضعیت تسویه", "خالص تسویه", "تاریخ عضویت", "یادداشت"], true),
      ...(data.members ?? []).map((m) =>
        excelRow([
          m.name,
          m.shares,
          m.phone || "—",
          m.totalDeposited,
          m.settled ? "تسویه‌شده" : "در جریان",
          m.settlementNet ?? 0,
          faDate(m.createdAt),
          m.note || "—",
        ]),
      ),
    ];
    if ((data.members ?? []).length === 0) rows.push(excelRow(["عضوی ثبت نشده است"]));
    sheets.push({ name: "اعضا", rows });
  }

  if (selected.includes("deposits")) {
    const rows = [
      excelRow(["تاریخ", "عضو", "عنوان", "نوع", "دوره", "مبلغ (تومان)"], true),
      ...(data.deposits ?? []).map((d) =>
        excelRow([
          faDate(d.createdAt),
          d.memberName,
          d.title,
          DEPOSIT_TYPE_FA[d.type] ?? d.type,
          d.periodKey || "—",
          d.amount,
        ]),
      ),
    ];
    if ((data.deposits ?? []).length === 0) rows.push(excelRow(["واریزی ثبت نشده است"]));
    sheets.push({ name: "واریزی‌ها", rows });
  }

  if (selected.includes("loans")) {
    const rows = [
      excelRow(["تاریخ ثبت", "عضو", "اصل (تومان)", "سود (تومان)", "کل بازپرداخت (تومان)", "واریز شده (تومان)", "تعداد اقساط", "وضعیت"], true),
      ...(data.loans ?? []).map((l) =>
        excelRow([
          faDate(l.createdAt),
          l.memberName,
          l.principal,
          l.interestAmount,
          l.totalAmount,
          l.disbursedAmount,
          l.installmentCount,
          STATUS_FA[l.status] ?? l.status,
        ]),
      ),
    ];
    if ((data.loans ?? []).length === 0) rows.push(excelRow(["وامی ثبت نشده است"]));
    sheets.push({ name: "وام‌ها", rows });

    const instRows = [excelRow(["عضو", "تاریخ وام", "شماره قسط", "سررسید", "مبلغ (تومان)", "پرداخت‌شده؟"], true)];
    let anyInstallment = false;
    (data.loans ?? []).forEach((l) => {
      l.installments.forEach((row) => {
        anyInstallment = true;
        instRows.push(
          excelRow([l.memberName, faDate(l.createdAt), row.number, faDate(row.dueAt), row.amount, row.paid ? "بله" : "خیر"]),
        );
      });
    });
    if (!anyInstallment) instRows.push(excelRow(["قسطی وجود ندارد"]));
    sheets.push({ name: "اقساط", rows: instRows });
  }

  if (selected.includes("requests")) {
    const rows = [excelRow(["کاربر", "نوع", "مبلغ (تومان)", "وضعیت", "تاریخ ثبت", "تاریخ بررسی", "پیام مدیر"], true)];
    (data.paymentRequests ?? []).forEach((r) => {
      rows.push(
        excelRow([
          r.username,
          KIND_FA[r.kind] ?? r.kind + (r.installmentNumber ? ` ${faNum(r.installmentNumber)}` : ""),
          r.amount,
          STATUS_FA[r.status] ?? r.status,
          faDate(r.createdAt),
          r.reviewedAt ? faDate(r.reviewedAt) : "—",
          r.reviewNote || "—",
        ]),
      );
    });
    (data.loanRequests ?? []).forEach((q) => {
      rows.push(
        excelRow([
          q.username,
          `درخواست تسهیلات (${faNum(q.months)} ماهه)`,
          q.amount,
          STATUS_FA[q.status] ?? q.status,
          faDate(q.createdAt),
          q.reviewedAt ? faDate(q.reviewedAt) : "—",
          q.reviewNote || "—",
        ]),
      );
    });
    const payouts = data.loanPayoutAccounts ?? [];
    payouts.forEach((p) => {
      rows.push(excelRow(["—", "حساب واریز تسهیلات", "—", "—", "—", "—", `${p.holder || "—"} — کارت ${p.cardNumber || "—"} — شبا ${p.sheba || "—"}`]));
    });
    if ((data.paymentRequests ?? []).length === 0 && (data.loanRequests ?? []).length === 0 && payouts.length === 0) {
      rows.push(excelRow(["درخواستی ثبت نشده است"]));
    }
    sheets.push({ name: "درخواست‌ها", rows });
  }

  if (selected.includes("settings")) {
    const s = data.settings;
    const rows: string[] = [];
    if (!s) {
      rows.push(excelRow(["تنظیماتی یافت نشد"]));
    } else {
      rows.push(
        excelRow(["عنوان", "مقدار"]),
        excelRow(["مبلغ هر سهم (تومان)", s.amountPerShare]),
        excelRow(["هشدار تراکنش مشابه", s.duplicateWarning ? "روشن" : "خاموش"]),
        excelRow(["عنوان‌های آماده واریز", (s.depositTitles ?? []).join(" ، ") || "—"]),
        excelRow(["حساب اصلی — بنام", s.depositAccounts?.primary?.holder || "—"]),
        excelRow(["حساب اصلی — شماره کارت", s.depositAccounts?.primary?.cardNumber || "—"]),
        excelRow(["حساب اصلی — شبا", s.depositAccounts?.primary?.sheba || "—"]),
        excelRow(["حساب جایگزین — بنام", s.depositAccounts?.alternate?.holder || "—"]),
        excelRow(["حساب جایگزین — شماره کارت", s.depositAccounts?.alternate?.cardNumber || "—"]),
        excelRow(["حساب جایگزین — شبا", s.depositAccounts?.alternate?.sheba || "—"]),
      );
    }
    sheets.push({ name: "تنظیمات", rows });
  }

  if (selected.includes("audit")) {
    const rows = [
      excelRow(["زمان", "عملیات", "موضوع", "توضیح"], true),
      ...(data.audit ?? []).map((a) =>
        excelRow([faDate(a.at), a.action, a.kind, a.detail]),
      ),
    ];
    if ((data.audit ?? []).length === 0) rows.push(excelRow(["سابقه‌ای ثبت نشده است"]));
    sheets.push({ name: "سوابق", rows });
  }

  return sheets;
}

function buildExcel(data: AdminBackupPayload, selected: PartKey[]): string {
  const sheets = buildSheets(data, selected).map((s) => excelSheet(s.name, s.rows));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
    `<Style ss:ID="h"><Font ss:Bold="1" ss:FontName="Tahoma"/></Style>` +
    `</Styles>` +
    sheets.join("") +
    `</Workbook>`
  );
}

function buildPrintHtml(data: AdminBackupPayload, selected: PartKey[]): string {
  const sections = buildSheets(data, selected)
    .map((s) => {
      // برگه‌های اکسل ردیف اولشان سرستون است؛ برای HTML همان جدول را بازسازی می‌کنیم
      const rows = s.rows
        .map((rowXml) => {
          const cells = [...rowXml.matchAll(/<Data ss:Type="(Number|String)">([\s\S]*?)<\/Data>/g)].map(
            (m) => {
              if (m[1] === "Number") return faNum(Number(m[2]));
              // مقدارهای اکسل escape شده‌اند — قبل از escape دومِ HTML برمی‌گردانیم
              return m[2]
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, "&");
            },
          );
          return cells;
        })
        .filter((cells) => cells.length > 0);
      const [head, ...body] = rows;
      return `<h2>${htmlEscape(s.name)}</h2>` + htmlTable(head ?? [], body);
    })
    .join("");
  return `<!doctype html>
<html dir="rtl" lang="fa"><head><meta charset="utf-8" />
<title>پشتیبان‌گیری بانک — فَم بانک</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif; direction: rtl; margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 2px solid #38bdf8; padding-bottom: 4px; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 6px; }
  .brand { font-size: 12px; font-weight: bold; color: #0284c7; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11.5px; text-align: right; }
  th { background: #f0f9ff; }
  @media print { h2 { page-break-after: avoid; } table { page-break-inside: auto; } }
</style></head><body>
<p class="brand">فَم بانک — Fam Bank</p>
<h1>پشتیبان‌گیری داده‌های بانک</h1>
<p class="meta">بخش‌های انتخابی: ${htmlEscape(selected.map((k) => LABELS[k]).join(" ، "))} — تولید شده در ${faDate(data.generatedAt)}</p>
${sections}
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body></html>`;
}

export default function AdminSelectiveBackup() {
  const [selected, setSelected] = useState<PartKey[]>(PARTS.map((p) => p.key));
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");

  function toggle(key: PartKey) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function loadData(): Promise<AdminBackupPayload> {
    const res = await fetch(`/api/admin/backup?parts=${selected.join(",")}`);
    const data = (await res.json()) as AdminBackupPayload | { error?: string };
    if (!res.ok || !("generatedAt" in data)) {
      throw new Error(("error" in data && data.error) || "دریافت اطلاعات ناموفق بود.");
    }
    return data;
  }

  async function downloadExcel() {
    setBusy("excel");
    setError("");
    try {
      const data = await loadData();
      const xml = buildExcel(data, selected);
      const blob = new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fam-bank-admin-backup-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت فایل اکسل ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  async function openPrintablePdf() {
    setBusy("pdf");
    setError("");
    try {
      const data = await loadData();
      const w = window.open("", "_blank");
      if (!w) {
        setError("پنجره چاپ باز نشد — Pop-up مرورگر را برای این سایت مجاز کنید.");
        return;
      }
      w.document.write(buildPrintHtml(data, selected));
      w.document.close();
      w.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت نسخه PDF ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
      <h4 className="text-sm font-bold">پشتیبان‌گیری انتخابی (اکسل و PDF)</h4>
      <p className="text-xs leading-6 text-zinc-500">
        بخش‌های دلخواه را انتخاب کنید و خروجی بگیرید: فایل اکسل مستقیم دانلود
        می‌شود و برای PDF، صفحه چاپ باز می‌شود — در پنجره چاپ گزینه «ذخیره
        به‌صورت PDF» را انتخاب کنید.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PARTS.map((p) => {
          const checked = selected.includes(p.key);
          return (
            <label
              key={p.key}
              className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-sm transition ${
                checked
                  ? "border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/40"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.key)}
                disabled={busy !== null}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">{p.title}</span>
                <span className="mt-0.5 block text-[10.5px] leading-5 text-zinc-500">{p.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelected(selected.length === PARTS.length ? [] : PARTS.map((p) => p.key))}
          className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-300"
          disabled={busy !== null}
        >
          {selected.length === PARTS.length ? "لغو انتخاب همه" : "انتخاب همه"}
        </button>
        <span className="text-[11px] text-zinc-500">
          {selected.length.toLocaleString("fa-IR")} بخش انتخاب شده
        </span>
      </div>

      {selected.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          حداقل یک بخش را برای پشتیبان‌گیری انتخاب کنید.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void downloadExcel()}
          disabled={busy !== null || selected.length === 0}
          className="clay-press flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-3.5 text-right shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <ClayIcon name="download" size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">دریافت فایل اکسل</span>
            <span className="mt-0.5 block text-[10.5px] text-zinc-500">
              فایل .xls با برگهٔ هر بخش انتخابی
            </span>
          </span>
          {busy === "excel" && <span className="text-[10px] text-zinc-400">در حال ساخت…</span>}
        </button>
        <button
          type="button"
          onClick={() => void openPrintablePdf()}
          disabled={busy !== null || selected.length === 0}
          className="clay-press flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-3.5 text-right shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <ClayIcon name="receipt" size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">دریافت PDF</span>
            <span className="mt-0.5 block text-[10.5px] text-zinc-500">
              صفحه چاپ باز می‌شود؛ «ذخیره به‌صورت PDF» را انتخاب کنید
            </span>
          </span>
          {busy === "pdf" && <span className="text-[10px] text-zinc-400">در حال ساخت…</span>}
        </button>
      </div>
    </div>
  );
}
