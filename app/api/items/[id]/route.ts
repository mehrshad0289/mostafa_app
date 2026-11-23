import { deleteItem, updateItem } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    note?: string;
    done?: boolean;
  };

  const item = await updateItem(id, body);
  if (!item) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(item);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const removed = await deleteItem(id);

  if (!removed) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
