import { db, episodes, carousels, slides, type Episode, type Carousel, type Slide } from "@clip-panda/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const uuid = z.string().uuid();
function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

/**
 * Ownership checks for API routes. Every resource in this app ultimately
 * belongs to a user via `episodes.userId` — carousels and slides join up to
 * that. Each helper returns the resource only if `userId` owns it, or
 * `null` if the resource doesn't exist OR belongs to someone else (the two
 * cases are deliberately indistinguishable to callers, so routes should
 * respond 404 either way rather than leaking existence).
 */

export async function requireEpisodeOwner(
  episodeId: string,
  userId: string
): Promise<Episode | null> {
  if (!isUuid(episodeId)) return null;
  const episode = await db.query.episodes.findFirst({ where: eq(episodes.id, episodeId) });
  if (!episode || episode.userId !== userId) return null;
  return episode;
}

export async function requireCarouselOwner(
  carouselId: string,
  userId: string
): Promise<Carousel | null> {
  if (!isUuid(carouselId)) return null;
  const carousel = await db.query.carousels.findFirst({ where: eq(carousels.id, carouselId) });
  if (!carousel) return null;
  const episode = await requireEpisodeOwner(carousel.episodeId, userId);
  return episode ? carousel : null;
}

export async function requireSlideOwner(slideId: string, userId: string): Promise<Slide | null> {
  if (!isUuid(slideId)) return null;
  const slide = await db.query.slides.findFirst({ where: eq(slides.id, slideId) });
  if (!slide) return null;
  const carousel = await requireCarouselOwner(slide.carouselId, userId);
  return carousel ? slide : null;
}
