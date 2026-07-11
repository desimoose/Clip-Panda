import { runPollLoop } from "./poll.js";
import { db, episodes } from "@clip-panda/db";
import { eq, inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";

async function tick() {
  const pending = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing"]),
  });

  for (const episode of pending) {
    if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
      await fetchSourceForEpisode(episode.id);
    }
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
