import { createItem, getItems } from "@/lib/db";

export async function GET() {
  const items = await getItems();
  return Response.json(items);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; note?: string };
  const title = body.title?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const item = await createItem({
    title,
    note: body.note?.trim() ?? "",
  });

  return Response.json(item, { status: 201 });
}
