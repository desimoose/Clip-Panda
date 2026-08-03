import { execFile as execFileCb } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, episodes } from "@clip-panda/db";
import { uploadObject } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

const execFile = promisify(execFileCb);

export async function fetchSourceForEpisode(episodeId: string): Promise<void> {
  const episode = await db.query.episodes.findFirst({
    where: eq(episodes.id, episodeId),
  });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);

  const outputPath = join(tmpdir(), `${episodeId}-source.mp4`);

  try {
    if (episode.sourceType === "youtube_url") {
      await execFile("yt-dlp", ["-f", "mp4", "-o", outputPath, episode.sourceUri]);
    } else if (episode.sourceType === "direct_url") {
      const response = await fetch(episode.sourceUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${episode.sourceUri}: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(outputPath, Buffer.from(arrayBuffer))
      );
    } else {
      throw new Error(`fetchSourceForEpisode called for non-URL sourceType ${episode.sourceType}`);
    }

    const buffer = await readFile(outputPath);
    const key = `episodes/${episodeId}/source.mp4`;
    await uploadObject(key, buffer, "video/mp4");

    await db
      .update(episodes)
      .set({ sourceUri: key, status: "transcribing" })
      .where(eq(episodes.id, episodeId));
  } catch (error) {
    await db
      .update(episodes)
      .set({ status: "failed", failureReason: (error as Error).message })
      .where(eq(episodes.id, episodeId));
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}
