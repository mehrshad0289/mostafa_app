"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ItemKind } from "@/lib/db";

type Item = {
  id: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string;
  kind: ItemKind;
};

type NotesPanelProps = {
  /** کدام بخش از داده‌ها نمایش داده شود؛ undefined یعنی همه */
  kind?: ItemKind;
  emptyText?: string;
};

export default function NotesPanel({ kind, emptyText }: NotesPanelProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const query = kind ? `?kind=${kind}` : "";

  async function loadItems() {
    const response = await fetch(`/api/items${query}`, { cache: "no-store" });
    const data = (await response.json()) as Item[];
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch(`/api/items${query}`, { cache: "no-store" });
      const data = (await response.json()) as Item[];
      if (active) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || saving) {
      return;
    }

    setSaving(true);
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, note, kind }),
    });
    setTitle("");
    setNote("");
    await loadItems();
    setSaving(false);
  }

  async function toggleDone(item: Item) {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    await loadItems();
  }

  async function removeItem(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    await loadItems();
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="عنوان"
            className="w-full rounded-xl border border-zinc-200 bg-transparent px-4 py-3 outline-none focus:border-zinc-400 dark:border-zinc-800"
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="توضیح"
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-transparent px-4 py-3 outline-none focus:border-zinc-400 dark:border-zinc-800"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-zinc-900 px-4 py-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "در حال ذخیره..." : "افزودن"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        {loading ? (
          <p className="text-zinc-500">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-500">{emptyText ?? "موردی ثبت نشده است."}</p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="space-y-1">
                <h2
                  className={`text-lg font-medium ${item.done ? "text-zinc-400 line-through" : ""}`}
                >
                  {item.title}
                </h2>
                {item.note ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.note}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => toggleDone(item)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  {item.done ? "باز کردن" : "انجام شد"}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-red-600 dark:border-zinc-800"
                >
                  حذف
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
