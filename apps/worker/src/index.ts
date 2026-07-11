import { runPollLoop } from "./poll.js";
import { db, episodes } from "@clip-panda/db";
import { inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";
import { transcribeEpisode } from "./jobs/transcribeEpisode.js";

async function tick() {
  const pending = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing", "transcribing"]),
  });

  for (const episode of pending) {
    if (episode.status === "importing") {
      if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
        await fetchSourceForEpisode(episode.id);
      }
    } else if (episode.status === "transcribing") {
      await transcribeEpisode(episode.id);
    }
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
