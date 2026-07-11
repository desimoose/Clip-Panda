import { auth } from "@/auth";
import { db, episodes } from "@clip-panda/db";
import { uploadObject } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

function extensionFor(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  return "bin";
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const title = form.get("title");
  const file = form.get("file");

  if (typeof title !== "string" || !(file instanceof File)) {
    return Response.json({ error: "title and file are required" }, { status: 400 });
  }

  const isAudio = file.type.startsWith("audio/");
  const [row] = await db
    .insert(episodes)
    .values({
      userId: session.user.id,
      title,
      sourceType: isAudio ? "audio_only" : "upload",
      sourceUri: "",
      status: "importing",
    })
    .returning();

  const ext = extensionFor(file.type);
  const key = `episodes/${row.id}/source.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, buffer, file.type);

  await db
    .update(episodes)
    .set({ sourceUri: key, status: "transcribing" })
    .where(eq(episodes.id, row.id));

  return Response.json({ episodeId: row.id }, { status: 201 });
}
