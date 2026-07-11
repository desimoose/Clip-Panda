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
  const sourceUrl = form.get("sourceUrl");

  if (typeof title !== "string") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  if (typeof sourceUrl === "string" && sourceUrl.length > 0) {
    const sourceType = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")
      ? "youtube_url"
      : "direct_url";
    const [row] = await db
      .insert(episodes)
      .values({ userId: session.user.id, title, sourceType, sourceUri: sourceUrl, status: "importing" })
      .returning();
    return Response.json({ episodeId: row.id }, { status: 201 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "file or sourceUrl is required" }, { status: 400 });
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
