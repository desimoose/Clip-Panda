import { describe, it, expect, vi } from "vitest";

const dbState = {
  slide: { id: "slide-1", carouselId: "carousel-1", orderIndex: 1, timestampMs: 5000, captionText: "hello", status: "pending" },
  carousel: { id: "carousel-1", episodeId: "ep-1", captionStyleId: "style-1" },
  episode: { id: "ep-1", sourceType: "upload", sourceUri: "episodes/ep-1/source.mp4" },
  style: { id: "style-1", name: "Bold Yellow", isPreset: true, font: "Inter-Bold", textColor: "#FFF", highlightColor: "#FFD700", size: 56, position: "bottom" },
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      slides: { findFirst: vi.fn().mockImplementation(async () => dbState.slide) },
      carousels: { findFirst: vi.fn().mockImplementation(async () => dbState.carousel) },
      episodes: { findFirst: vi.fn().mockImplementation(async () => dbState.episode) },
      captionStyles: { findFirst: vi.fn().mockImplementation(async () => dbState.style) },
    },
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.slide, patch);
        },
      }),
    }),
  },
  slides: {},
  carousels: {},
  episodes: {},
  captionStyles: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake source video")),
  uploadObject: vi.fn().mockResolvedValue("carousels/carousel-1/slide-1.png"),
}));

vi.mock("../frames.js", () => ({
  extractFrame: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake frame png")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sharp", () => {
  const instance = {
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("composited png")),
    resize: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn().mockReturnValue(instance) };
});

vi.mock("@clip-panda/render", () => ({
  renderOverlayPng: vi.fn().mockReturnValue(Buffer.from("overlay png")),
}));

import { renderSlide } from "./renderSlide.js";

describe("renderSlide", () => {
  it("renders a video-frame slide and marks it rendered", async () => {
    await renderSlide("slide-1");
    expect(dbState.slide.status).toBe("rendered");
    expect((dbState.slide as any).imageUrl).toBe("carousels/carousel-1/slide-1.png");
  });
});
