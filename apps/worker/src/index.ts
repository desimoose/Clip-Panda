import { runPollLoop } from "./poll.js";
import { db, episodes, slides } from "@clip-panda/db";
import { inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";
import { transcribeEpisode } from "./jobs/transcribeEpisode.js";
import { renderSlide } from "./jobs/renderSlide.js";

async function tick() {
  const pendingEpisodes = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing", "transcribing"]),
  });

  for (const episode of pendingEpisodes) {
    if (episode.status === "importing") {
      if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
        await fetchSourceForEpisode(episode.id);
      }
    } else if (episode.status === "transcribing") {
      await transcribeEpisode(episode.id);
    }
  }

  const pendingSlides = await db.query.slides.findMany({
    where: inArray(slides.status, ["pending"]),
  });

  for (const slide of pendingSlides) {
    await renderSlide(slide.id);
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
