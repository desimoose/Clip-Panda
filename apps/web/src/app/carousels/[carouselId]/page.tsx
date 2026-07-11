"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Slide {
  id: string;
  orderIndex: number;
  status: "pending" | "rendered" | "failed";
  downloadUrl: string | null;
}

export default function CarouselGalleryPage() {
  const { carouselId } = useParams<{ carouselId: string }>();
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const response = await fetch(`/api/carousels/${carouselId}`);
      const json = await response.json();
      if (!cancelled) setSlides(json.slides);
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [carouselId]);

  async function regenerate(slideId: string) {
    await fetch(`/api/slides/${slideId}/regenerate`, { method: "POST" });
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Your carousel</h1>
        <a
          href={`/api/carousels/${carouselId}/export`}
          className="bg-black text-white rounded px-4 py-2"
        >
          Download All
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {slides.map((slide) => (
          <div key={slide.id} className="border rounded overflow-hidden">
            {slide.status === "rendered" && slide.downloadUrl ? (
              <img src={slide.downloadUrl} alt={`Slide ${slide.orderIndex + 1}`} />
            ) : (
              <div className="aspect-video flex items-center justify-center text-sm text-gray-500">
                {slide.status}
              </div>
            )}
            <button className="w-full text-sm py-1" onClick={() => regenerate(slide.id)}>
              Regenerate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
