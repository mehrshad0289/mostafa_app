import type { Metadata } from "next";
import Link from "next/link";
import NotesPanel from "../components/NotesPanel";

export const metadata: Metadata = {
  title: "Mostafa App حقیقی",
  description: "پنل اشخاص حقیقی Mostafa App",
};

export default function HaqiqiPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">پنل اشخاص حقیقی</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Mostafa App حقیقی
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          یادداشت‌های این بخش جدا از صفحه اصلی و فقط برای اشخاص حقیقی ذخیره
          می‌شود.
        </p>
      </header>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          href="/"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← بازگشت به Mostafa App
        </Link>
        <Link
          href="/bank"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          → فم بانک
        </Link>
      </div>

      <NotesPanel kind="haqiqi" emptyText="در این بخش موردی ثبت نشده است." />
    </main>
  );
}
