import { auth } from "@/auth";
import { db, slides } from "@clip-panda/db";
import { eq } from "drizzle-orm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slideId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slideId } = await params;
  await db
    .update(slides)
    .set({ status: "pending", failureReason: null, imageUrl: null })
    .where(eq(slides.id, slideId));

  return Response.json({ ok: true });
}
