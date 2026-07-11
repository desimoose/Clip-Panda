import archiver from "archiver";
import { PassThrough } from "node:stream";
import { db, slides } from "@clip-panda/db";
import { getObjectBuffer } from "@clip-panda/storage";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
): Promise<Response> {
  const { carouselId } = await params;
  const carouselSlides = await db.query.slides.findMany({
    where: and(eq(slides.carouselId, carouselId), eq(slides.status, "rendered")),
    orderBy: (s, { asc }) => [asc(s.orderIndex)],
  });

  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(passthrough);

  for (const slide of carouselSlides) {
    if (!slide.imageUrl) continue;
    const buffer = await getObjectBuffer(slide.imageUrl);
    archive.append(buffer, { name: `slide-${String(slide.orderIndex + 1).padStart(2, "0")}.png` });
  }
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(Buffer.from(chunk));
  }

  return new Response(Buffer.concat(chunks), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="carousel-${carouselId}.zip"`,
    },
  });
}
