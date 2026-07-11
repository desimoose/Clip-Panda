import { db, slides } from "@clip-panda/db";
import { getSignedDownloadUrl } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
): Promise<Response> {
  const { carouselId } = await params;
  const carouselSlides = await db.query.slides.findMany({
    where: eq(slides.carouselId, carouselId),
    orderBy: (s, { asc }) => [asc(s.orderIndex)],
  });

  const withUrls = await Promise.all(
    carouselSlides.map(async (slide) => ({
      ...slide,
      downloadUrl: slide.imageUrl ? await getSignedDownloadUrl(slide.imageUrl) : null,
    }))
  );

  return Response.json({ slides: withUrls });
}
