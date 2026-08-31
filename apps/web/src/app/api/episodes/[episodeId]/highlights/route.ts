import { auth } from "@/auth";
import { db, transcripts } from "@clip-panda/db";
import { extractHighlights } from "@clip-panda/gemini";
import { requireEpisodeOwner } from "@/lib/ownership";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const episode = await requireEpisodeOwner(episodeId, session.user.id);
  if (!episode) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const count = Number(new URL(request.url).searchParams.get("count") ?? "15");
  if (!Number.isInteger(count) || count < 10 || count > 20) {
    return Response.json({ error: "count must be an integer between 10 and 20" }, { status: 400 });
  }

  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.episodeId, episodeId),
  });
  if (!transcript) {
    return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
  }

  const highlights = await extractHighlights(transcript.segments, count);
  return Response.json({ highlights });
}
