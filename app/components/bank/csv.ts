"use client";

import { toCsv } from "@/lib/bank";

/** دانلود فایل CSV با BOM (سازگار Excel) و پسوند تاریخ امروز در نام فایل */
export function downloadCsv(
  baseName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const csv = toCsv(headers, rows);
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  link.href = url;
  link.download = `${baseName}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
