import { auth } from "@/auth";
import { db, carousels, slides, transcripts } from "@clip-panda/db";
import { sampleFrameTimestamps, findCaptionForTimestamp } from "@clip-panda/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

const highlightsBodySchema = z.object({
  mode: z.literal("highlights"),
  captionStyleId: z.string().uuid(),
  highlights: z
    .array(z.object({ timestampMs: z.number().int().min(0), captionText: z.string().min(1) }))
    .min(10)
    .max(20),
});

const storyboardBodySchema = z.object({
  mode: z.literal("storyboard"),
  captionStyleId: z.string().uuid(),
  clipStartMs: z.number().int().min(0),
  clipEndMs: z.number().int().min(0),
  slideCount: z.number().int().min(10).max(20),
});

const bodySchema = z.discriminatedUnion("mode", [highlightsBodySchema, storyboardBodySchema]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  let slideInputs: { timestampMs: number; captionText: string }[];

  if (body.mode === "highlights") {
    slideInputs = body.highlights;
  } else {
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.episodeId, episodeId),
    });
    if (!transcript) {
      return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
    }
    const timestamps = sampleFrameTimestamps(body.clipStartMs, body.clipEndMs, body.slideCount);
    slideInputs = timestamps.map((timestampMs) => ({
      timestampMs,
      captionText: findCaptionForTimestamp(transcript.segments, timestampMs),
    }));
  }

  const [carousel] = await db
    .insert(carousels)
    .values({
      episodeId,
      mode: body.mode,
      clipStartMs: body.mode === "storyboard" ? body.clipStartMs : null,
      clipEndMs: body.mode === "storyboard" ? body.clipEndMs : null,
      captionStyleId: body.captionStyleId,
      status: "pending",
    })
    .returning();

  await db
    .insert(slides)
    .values(
      slideInputs.map((s, index) => ({
        carouselId: carousel.id,
        orderIndex: index,
        timestampMs: s.timestampMs,
        captionText: s.captionText,
        status: "pending" as const,
      }))
    )
    .returning();

  return Response.json({ carouselId: carousel.id }, { status: 201 });
}
