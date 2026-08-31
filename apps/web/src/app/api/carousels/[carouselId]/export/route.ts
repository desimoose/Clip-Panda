import archiver from "archiver";
import { Readable } from "node:stream";
import { auth } from "@/auth";
import { db, slides } from "@clip-panda/db";
import { getObjectBuffer } from "@clip-panda/storage";
import { requireCarouselOwner } from "@/lib/ownership";
import { eq, and } from "drizzle-orm";

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
    where: and(eq(slides.carouselId, carouselId), eq(slides.status, "rendered")),
    orderBy: (s, { asc }) => [asc(s.orderIndex)],
  });

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err) => console.error("zip export warning:", err));
  archive.on("error", (err) => console.error("zip export error:", err));

  // Feed entries into the archive asynchronously; the archive stream itself
  // is handed to the Response below and streams to the client as entries
  // are appended, instead of buffering the whole zip in memory first.
  (async () => {
    for (const slide of carouselSlides) {
      if (!slide.imageUrl) continue;
      const buffer = await getObjectBuffer(slide.imageUrl);
      archive.append(buffer, { name: `slide-${String(slide.orderIndex + 1).padStart(2, "0")}.png` });
    }
    await archive.finalize();
  })();

  return new Response(Readable.toWeb(archive) as ReadableStream, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="carousel-${carouselId}.zip"`,
    },
  });
}
