"use client";

import { useState } from "react";
import ClayIcon from "./ClayIcon";

/**
 * جلسه ۴۸ — پشتیبان‌گیری شخصی در تنظیمات یوزر (به درخواست کاربر: «گزینه
 * پشتیبان‌گیری بزار تا در صورتی که یوزر قصد داشت از اطلاعات پشتیبان گیری کند
 * بتواند در قالب اکسل و پی دی اف انجام دهد»).
 * - اکسل: بدون کتابخانه خارجی، فایل SpreadsheetML 2003 (.xls) با چند برگه و
 *   راست‌به‌چپ ساخته می‌شود؛ اکسل مستقیم بازش می‌کند.
 * - PDF: پنجره چاپ با نسخه مرتب RTL باز می‌شود و کاربر در پنجره چاپ مرورگر
 *   «ذخیره به‌صورت PDF» را انتخاب می‌کند (بدون افزودن وابستگی جدید به پروژه).
 * داده از GET /api/member/backup می‌آید و فقط اطلاعات خود کاربر است.
 */

type BackupPayload = {
  generatedAt: string;
  profile: { fullName: string; username: string; phone: string | null; role: string };
  member: {
    name: string;
    shares: number;
    phone: string;
    totalDeposited: number;
    settled: boolean;
    settlementNet: number | null;
    createdAt: string;
  } | null;
  deposits: { type: string; title: string; amount: number; periodKey: string; createdAt: string }[];
  loans: {
    principal: number;
    interestMode: string;
    interestAmount: number;
    totalAmount: number;
    disbursedAmount: number;
    installmentCount: number;
    status: string;
    note: string;
    createdAt: string;
    installments: { number: number; amount: number; dueAt: string; paid: boolean }[];
    payments: { amount: number; paidAt: string; note: string }[];
  }[];
  paymentRequests: {
    kind: string;
    amount: number;
    note: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    installmentNumber: number | null;
  }[];
  loanRequests: {
    amount: number;
    months: number;
    reason: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  }[];
};

const STATUS_FA: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  rejected: "رد شده",
};

const LOAN_STATUS_FA: Record<string, string> = {
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

function htmlEscape(text: string): string {
  return xmlEscape(text);
}

/** ردیف اکسل: مقادیر عددی با Type="Number" تا اکسل بتواند جمع بزند */
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
  return `<Worksheet ss:Name="${xmlEscape(name)}" ss:RightToLeft="1"><Table>${rows.join("")}</Table></Worksheet>`;
}

/** ساخت فایل اکسل (SpreadsheetML 2003) — بدون هیچ کتابخانه خارجی */
function buildExcel(data: BackupPayload): string {
  const info: (string | number)[][] = [
    ["عنوان", "مقدار"],
    ["نام", data.profile.fullName || "—"],
    ["نام کاربری", data.profile.username],
    ["شماره تلفن", data.profile.phone || "—"],
    ["نقش", data.profile.role === "admin" ? "مدیر" : "عضو"],
  ];
  if (data.member) {
    info.push(
      ["تعداد سهم", data.member.shares],
      ["جمع واریزی‌ها (تومان)", data.member.totalDeposited],
      ["وضعیت تسویه", data.member.settled ? "تسویه‌شده" : "در جریان"],
      ["خالص تسویه (تومان)", data.member.settlementNet ?? 0],
      ["تاریخ عضویت", faDate(data.member.createdAt)],
    );
  }
  info.push(["زمان تولید پشتیبان", faDate(data.generatedAt)]);

  const sheets: string[] = [excelSheet("اطلاعات من", info.map((r) => excelRow(r)))];

  const depositRows = [
    excelRow(["تاریخ", "عنوان", "نوع", "دوره", "مبلغ (تومان)"], true),
    ...data.deposits.map((d) =>
      excelRow([faDate(d.createdAt), d.title, DEPOSIT_TYPE_FA[d.type] ?? d.type, d.periodKey || "—", d.amount]),
    ),
  ];
  if (data.deposits.length === 0) depositRows.push(excelRow(["واریزی ثبت‌شده‌ای وجود ندارد"]));
  sheets.push(excelSheet("واریزی‌ها", depositRows));

  const loanRows = [
    excelRow(["تاریخ ثبت", "اصل (تومان)", "سود (تومان)", "کل بازپرداخت (تومان)", "واریز شده (تومان)", "تعداد اقساط", "وضعیت"], true),
    ...data.loans.map((l) =>
      excelRow([
        faDate(l.createdAt),
        l.principal,
        l.interestAmount,
        l.totalAmount,
        l.disbursedAmount,
        l.installmentCount,
        LOAN_STATUS_FA[l.status] ?? l.status,
      ]),
    ),
  ];
  if (data.loans.length === 0) loanRows.push(excelRow(["وام ثبت‌شده‌ای وجود ندارد"]));
  sheets.push(excelSheet("وام‌ها", loanRows));

  const installmentRows = [excelRow(["وام", "شماره قسط", "سررسید", "مبلغ (تومان)", "پرداخت‌شده؟"], true)];
  data.loans.forEach((l, li) => {
    l.installments.forEach((row) => {
      installmentRows.push(
        excelRow([`وام ${li + 1} (${faDate(l.createdAt)})`, row.number, faDate(row.dueAt), row.amount, row.paid ? "بله" : "خیر"]),
      );
    });
  });
  if (data.loans.every((l) => l.installments.length === 0)) installmentRows.push(excelRow(["قسطی وجود ندارد"]));
  sheets.push(excelSheet("اقساط", installmentRows));

  const requestRows = [excelRow(["نوع", "مبلغ (تومان)", "وضعیت", "تاریخ ثبت", "تاریخ بررسی", "پیام مدیر", "توضیح"], true)];
  data.paymentRequests.forEach((r) => {
    requestRows.push(
      excelRow([
        KIND_FA[r.kind] ?? r.kind,
        r.amount,
        STATUS_FA[r.status] ?? r.status,
        faDate(r.createdAt),
        r.reviewedAt ? faDate(r.reviewedAt) : "—",
        r.reviewNote || "—",
        r.note || "—",
      ]),
    );
  });
  data.loanRequests.forEach((q) => {
    requestRows.push(
      excelRow([
        "درخواست تسهیلات",
        q.amount,
        STATUS_FA[q.status] ?? q.status,
        faDate(q.createdAt),
        q.reviewedAt ? faDate(q.reviewedAt) : "—",
        q.reviewNote || "—",
        `${q.months} ماهه — ${q.reason || "بدون دلیل"}`,
      ]),
    );
  });
  if (data.paymentRequests.length === 0 && data.loanRequests.length === 0) {
    requestRows.push(excelRow(["درخواستی ثبت نشده است"]));
  }
  sheets.push(excelSheet("درخواست‌ها", requestRows));

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
    `<Style ss:ID="h"><Font ss:Bold="1" ss:FontName="Tahoma"/></Style>` +
    `<Style ss:ID="d"><Font ss:FontName="Tahoma"/></Style>` +
    `</Styles>` +
    sheets.join("") +
    `</Workbook>`
  );
}

/** جدول HTML برای نسخه PDF/چاپ */
function htmlTable(headers: string[], rows: string[][]): string {
  return (
    `<table><thead><tr>${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`
  );
}

function buildPrintHtml(data: BackupPayload): string {
  const memberInfo = data.member
    ? htmlTable(
        ["تعداد سهم", "جمع واریزی‌ها", "وضعیت تسویه", "خالص تسویه", "تاریخ عضویت"],
        [
          [
            faNum(data.member.shares),
            `${faNum(data.member.totalDeposited)} تومان`,
            data.member.settled ? "تسویه‌شده" : "در جریان",
            `${faNum(data.member.settlementNet ?? 0)} تومان`,
            faDate(data.member.createdAt),
          ],
        ],
      )
    : "<p>این کاربر به عضوی از بانک متصل نیست.</p>";

  const depositSection =
    data.deposits.length === 0
      ? "<p>واریزی ثبت‌شده‌ای وجود ندارد.</p>"
      : htmlTable(
          ["تاریخ", "عنوان", "نوع", "دوره", "مبلغ"],
          data.deposits.map((d) => [
            faDate(d.createdAt),
            d.title,
            DEPOSIT_TYPE_FA[d.type] ?? d.type,
            d.periodKey || "—",
            `${faNum(d.amount)} تومان`,
          ]),
        );

  const loanSection =
    data.loans.length === 0
      ? "<p>وام ثبت‌شده‌ای وجود ندارد.</p>"
      : data.loans
          .map((l, i) => {
            const rows = [
              `<h3>وام ${faNum(i + 1)} — ثبت ${faDate(l.createdAt)}</h3>` +
                htmlTable(
                  ["اصل", "سود", "کل بازپرداخت", "واریز شده", "تعداد اقساط", "وضعیت"],
                  [
                    [
                      `${faNum(l.principal)} تومان`,
                      `${faNum(l.interestAmount)} تومان`,
                      `${faNum(l.totalAmount)} تومان`,
                      `${faNum(l.disbursedAmount)} تومان`,
                      faNum(l.installmentCount),
                      LOAN_STATUS_FA[l.status] ?? l.status,
                    ],
                  ],
                ),
            ];
            if (l.installments.length > 0) {
              rows.push(
                htmlTable(
                  ["شماره قسط", "سررسید", "مبلغ", "پرداخت‌شده؟"],
                  l.installments.map((row) => [
                    faNum(row.number),
                    faDate(row.dueAt),
                    `${faNum(row.amount)} تومان`,
                    row.paid ? "بله" : "خیر",
                  ]),
                ),
              );
            }
            return rows.join("");
          })
          .join("");

  const requestRows: string[][] = [
    ...data.paymentRequests.map((r) => [
      KIND_FA[r.kind] ?? r.kind,
      `${faNum(r.amount)} تومان`,
      STATUS_FA[r.status] ?? r.status,
      faDate(r.createdAt),
      r.reviewNote || "—",
    ]),
    ...data.loanRequests.map((q) => [
      "درخواست تسهیلات",
      `${faNum(q.amount)} تومان`,
      STATUS_FA[q.status] ?? q.status,
      faDate(q.createdAt),
      q.reviewNote || "—",
    ]),
  ];
  const requestSection =
    requestRows.length === 0
      ? "<p>درخواستی ثبت نشده است.</p>"
      : htmlTable(["نوع", "مبلغ", "وضعیت", "تاریخ", "پیام مدیر"], requestRows);

  return `<!doctype html>
<html dir="rtl" lang="fa"><head><meta charset="utf-8" />
<title>پشتیبان‌گیری اطلاعات — فَم بانک</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif; direction: rtl; margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 2px solid #38bdf8; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 14px 0 6px; }
  p { font-size: 12px; color: #475569; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 6px; }
  .brand { font-size: 12px; font-weight: bold; color: #0284c7; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11.5px; text-align: right; }
  th { background: #f0f9ff; }
  @media print { h2 { page-break-after: avoid; } table { page-break-inside: auto; } }
</style></head><body>
<p class="brand">فَم بانک — Fam Bank</p>
<h1>پشتیبان‌گیری اطلاعات</h1>
<p class="meta">${htmlEscape(data.profile.fullName || data.profile.username)} (@${htmlEscape(data.profile.username)}) — تولید شده در ${faDate(data.generatedAt)}</p>
<h2>اطلاعات من</h2>
${memberInfo}
<h2>واریزی‌ها</h2>
${depositSection}
<h2>وام‌ها و اقساط</h2>
${loanSection}
<h2>درخواست‌ها</h2>
${requestSection}
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body></html>`;
}

export default function BackupSection() {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");

  async function loadData(): Promise<BackupPayload> {
    const res = await fetch("/api/member/backup");
    const data = (await res.json()) as BackupPayload | { error?: string };
    if (!res.ok || !("profile" in data)) {
      throw new Error(("error" in data && data.error) || "دریافت اطلاعات ناموفق بود.");
    }
    return data;
  }

  async function downloadExcel() {
    setBusy("excel");
    setError("");
    try {
      const data = await loadData();
      const xml = buildExcel(data);
      const blob = new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fam-bank-backup-${new Date().toISOString().slice(0, 10)}.xls`;
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
      w.document.write(buildPrintHtml(data));
      w.document.close();
      w.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت نسخه PDF ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  const btnClass =
    "clay-press flex w-full items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-3.5 text-right shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary-200 bg-gradient-to-bl from-primary-50 to-white p-4 dark:border-primary-900 dark:from-primary-950/50 dark:to-zinc-950">
        <p className="text-xs leading-6 text-zinc-600 dark:text-zinc-300">
          از این بخش می‌توانید خلاصه اطلاعات خودتان (واریزی‌ها، وام‌ها، اقساط و
          درخواست‌ها) را دریافت کنید: فایل اکسل مستقیم دانلود می‌شود و برای PDF،
          صفحه چاپ باز می‌شود — در پنجره چاپ گزینه «ذخیره به‌صورت PDF» را انتخاب کنید.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <button type="button" onClick={() => void downloadExcel()} disabled={busy !== null} className={btnClass}>
        <ClayIcon name="download" size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">دریافت فایل اکسل</p>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            فایل .xls با برگه‌های واریزی‌ها، وام‌ها، اقساط و درخواست‌ها
          </p>
        </div>
        {busy === "excel" && <span className="text-[10px] text-zinc-400">در حال ساخت…</span>}
      </button>

      <button type="button" onClick={() => void openPrintablePdf()} disabled={busy !== null} className={btnClass}>
        <ClayIcon name="receipt" size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">دریافت PDF</p>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            صفحه چاپ باز می‌شود؛ گزینه «ذخیره به‌صورت PDF» را انتخاب کنید
          </p>
        </div>
        {busy === "pdf" && <span className="text-[10px] text-zinc-400">در حال ساخت…</span>}
      </button>
    </div>
  );
}
