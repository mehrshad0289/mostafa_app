import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import seed from "@/data/db.json";

export type ItemKind = "general" | "haqiqi";

export type Item = {
  id: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string;
  kind: ItemKind;
};

const KINDS: ItemKind[] = ["general", "haqiqi"];

export function normalizeKind(kind: unknown): ItemKind {
  return KINDS.includes(kind as ItemKind) ? (kind as ItemKind) : "general";
}

export function parseKind(value: string | null): ItemKind | undefined {
  return KINDS.includes(value as ItemKind) ? (value as ItemKind) : undefined;
}

type Database = {
  items: Item[];
};

const SOURCE_FILE = path.join(process.cwd(), "data", "db.json");
const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "mostafa-app-db.json")
  : SOURCE_FILE;

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    return {
      items: parsed.items.map((item) => ({
        ...item,
        kind: normalizeKind(item.kind),
      })),
    };
  } catch {
    return {
      items: seed.items.map((item) => ({
        ...item,
        kind: normalizeKind((item as { kind?: unknown }).kind),
      })),
    };
  }
}

async function writeDb(db: Database) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function getItems(kind?: ItemKind) {
  const db = await readDb();
  return kind ? db.items.filter((item) => item.kind === kind) : db.items;
}

export async function createItem(input: {
  title: string;
  note: string;
  kind?: ItemKind;
}) {
  const db = await readDb();
  const item: Item = {
    id: Date.now().toString(),
    title: input.title.trim(),
    note: input.note.trim(),
    done: false,
    createdAt: new Date().toISOString(),
    kind: normalizeKind(input.kind),
  };
  db.items.unshift(item);
  await writeDb(db);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<Item, "title" | "note" | "done">>,
) {
  const db = await readDb();
  const index = db.items.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }
  db.items[index] = { ...db.items[index], ...patch };
  await writeDb(db);
  return db.items[index];
}

export async function deleteItem(id: string) {
  const db = await readDb();
  const next = db.items.filter((item) => item.id !== id);
  if (next.length === db.items.length) {
    return false;
  }
  db.items = next;
  await writeDb(db);
  return true;
}
