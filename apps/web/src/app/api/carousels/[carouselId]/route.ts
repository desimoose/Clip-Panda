import { auth } from "@/auth";
import { db, slides } from "@clip-panda/db";
import { getSignedDownloadUrl } from "@clip-panda/storage";
import { requireCarouselOwner } from "@/lib/ownership";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { carouselId } = await params;
  const carousel = await requireCarouselOwner(carouselId, session.user.id);
  if (!carousel) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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
