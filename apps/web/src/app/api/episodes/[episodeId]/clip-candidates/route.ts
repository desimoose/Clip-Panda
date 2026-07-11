import { auth } from "@/auth";
import { db, transcripts } from "@clip-panda/db";
import { suggestClipCandidates } from "@clip-panda/gemini";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.episodeId, episodeId),
  });
  if (!transcript) {
    return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
  }

  const candidates = await suggestClipCandidates(transcript.segments);
  return Response.json({ candidates });
}
