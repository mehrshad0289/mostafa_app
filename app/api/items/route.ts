import { createItem, getItems, parseKind } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const items = await getItems(parseKind(searchParams.get("kind")));
  return Response.json(items);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    note?: string;
    kind?: string;
  };
  const title = body.title?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const item = await createItem({
    title,
    note: body.note?.trim() ?? "",
    kind: parseKind(body.kind ?? null),
  });

  return Response.json(item, { status: 201 });
}
