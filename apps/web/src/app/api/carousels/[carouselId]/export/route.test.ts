import { describe, it, expect, vi } from "vitest";

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      slides: {
        findMany: vi.fn().mockResolvedValue([
          { id: "s1", orderIndex: 0, imageUrl: "carousels/c1/slide-0.png", status: "rendered" },
          { id: "s2", orderIndex: 1, imageUrl: "carousels/c1/slide-1.png", status: "rendered" },
        ]),
      },
    },
  },
  slides: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake png bytes")),
}));

import { GET } from "./route.js";

describe("GET /api/carousels/:carouselId/export", () => {
  it("returns a zip response with the correct content type", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ carouselId: "c1" }),
    });

    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.status).toBe(200);
  });
});
