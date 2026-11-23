import Link from "next/link";
import NotesPanel from "./components/NotesPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">JSON Database</p>
        <h1 className="text-3xl font-semibold tracking-tight">Mostafa App</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          یادداشت‌ها در فایل JSON داخل خود Next.js ذخیره می‌شوند.
        </p>
      </header>

      <Link
        href="/haqiqi"
        className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Mostafa App حقیقی</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            پنل ویژه اشخاص حقیقی؛ یادداشت‌های این بخش جدا از صفحه اصلی نگهداری
            می‌شود.
          </p>
        </div>
        <span className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          ورود
        </span>
      </Link>

      <NotesPanel kind="general" emptyText="موردی ثبت نشده است." />
    </main>
  );
}
