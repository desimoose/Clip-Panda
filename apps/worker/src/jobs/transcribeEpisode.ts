import { db, episodes, transcripts } from "@clip-panda/db";
import { getObjectBuffer } from "@clip-panda/storage";
import { transcribeMedia } from "@clip-panda/gemini";
import { eq } from "drizzle-orm";
import { errorMessage } from "../errorMessage.js";

function mimeTypeFor(sourceUri: string): string {
  if (sourceUri.endsWith(".mp3")) return "audio/mpeg";
  if (sourceUri.endsWith(".wav")) return "audio/wav";
  if (sourceUri.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function transcribeEpisode(episodeId: string): Promise<void> {
  const episode = await db.query.episodes.findFirst({ where: eq(episodes.id, episodeId) });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);

  try {
    const buffer = await getObjectBuffer(episode.sourceUri);
    const segments = await transcribeMedia(buffer, mimeTypeFor(episode.sourceUri));

    await db.insert(transcripts).values({ episodeId, segments }).returning();
    await db.update(episodes).set({ status: "ready" }).where(eq(episodes.id, episodeId));
  } catch (error) {
    await db
      .update(episodes)
      .set({ status: "failed", failureReason: errorMessage(error) })
      .where(eq(episodes.id, episodeId));
  }
}
