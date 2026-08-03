import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { db, slides, carousels, episodes, captionStyles } from "@clip-panda/db";
import { getObjectBuffer, uploadObject } from "@clip-panda/storage";
import { renderOverlayPng } from "@clip-panda/render";
import { extractFrame } from "../frames.js";
import { eq } from "drizzle-orm";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

function renderQuoteCardBackground(): Buffer {
  const svg = `<svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#111111" />
  </svg>`;
  return Buffer.from(svg);
}

export async function renderSlide(slideId: string): Promise<void> {
  const slide = await db.query.slides.findFirst({ where: eq(slides.id, slideId) });
  if (!slide) throw new Error(`Slide ${slideId} not found`);

  try {
    const carousel = await db.query.carousels.findFirst({
      where: eq(carousels.id, slide.carouselId),
    });
    if (!carousel) throw new Error(`Carousel ${slide.carouselId} not found`);

    const episode = await db.query.episodes.findFirst({
      where: eq(episodes.id, carousel.episodeId),
    });
    if (!episode) throw new Error(`Episode ${carousel.episodeId} not found`);

    const style = await db.query.captionStyles.findFirst({
      where: eq(captionStyles.id, carousel.captionStyleId),
    });
    if (!style) throw new Error(`Caption style ${carousel.captionStyleId} not found`);

    let background: Buffer;

    if (episode.sourceType === "audio_only") {
      background = renderQuoteCardBackground();
      background = await sharp(background).resize(SLIDE_WIDTH, SLIDE_HEIGHT).png().toBuffer();
    } else {
      const sourceBuffer = await getObjectBuffer(episode.sourceUri);
      const sourcePath = join(tmpdir(), `${episode.id}-source.mp4`);
      await writeFile(sourcePath, sourceBuffer);

      const framePath = join(tmpdir(), `${slide.id}-frame.png`);
      await extractFrame(sourcePath, slide.timestampMs ?? 0, framePath);
      background = await sharp(await readFile(framePath))
        .resize(SLIDE_WIDTH, SLIDE_HEIGHT)
        .png()
        .toBuffer();

      await unlink(sourcePath).catch(() => {});
      await unlink(framePath).catch(() => {});
    }

    const overlay = renderOverlayPng({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      captionText: slide.captionText,
      style,
      watermarkText: "Clip Panda",
    });

    const composited = await sharp(background)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const key = `carousels/${carousel.id}/slide-${slide.orderIndex}.png`;
    await uploadObject(key, composited, "image/png");

    await db
      .update(slides)
      .set({ status: "rendered", imageUrl: key })
      .where(eq(slides.id, slideId));
  } catch (error) {
    await db
      .update(slides)
      .set({ status: "failed", failureReason: (error as Error).message })
      .where(eq(slides.id, slideId));
  }
}
