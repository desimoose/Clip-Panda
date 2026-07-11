import { auth } from "@/auth";
import { db, captionStyles } from "@clip-panda/db";
import { captionStyleSchema } from "@clip-panda/shared";

export async function GET(): Promise<Response> {
  const styles = await db.select().from(captionStyles);
  return Response.json({ styles });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = captionStyleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [style] = await db
    .insert(captionStyles)
    .values({ ...parsed.data, isPreset: false })
    .returning();

  return Response.json({ style }, { status: 201 });
}
