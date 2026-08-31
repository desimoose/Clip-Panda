import { describe, it, expect, vi } from "vitest";

// vi.mock factories are hoisted above top-level consts, so the ids they
// need have to be declared via vi.hoisted() rather than a plain const.
const { CAROUSEL_ID, EPISODE_ID } = vi.hoisted(() => ({
  CAROUSEL_ID: "22222222-2222-2222-2222-222222222222",
  EPISODE_ID: "11111111-1111-1111-1111-111111111111",
}));

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      episodes: {
        findFirst: vi.fn().mockResolvedValue({ id: EPISODE_ID, userId: "user-1" }),
      },
      carousels: {
        findFirst: vi.fn().mockResolvedValue({ id: CAROUSEL_ID, episodeId: EPISODE_ID }),
      },
      slides: {
        findMany: vi.fn().mockResolvedValue([
          { id: "s1", orderIndex: 0, imageUrl: "carousels/c1/slide-0.png", status: "rendered" },
          { id: "s2", orderIndex: 1, imageUrl: "carousels/c1/slide-1.png", status: "rendered" },
        ]),
      },
    },
  },
  episodes: {},
  carousels: {},
  slides: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake png bytes")),
}));

import { GET } from "./route.js";

describe("GET /api/carousels/:carouselId/export", () => {
  it("returns a zip response with the correct content type", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ carouselId: CAROUSEL_ID }),
    });

    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.status).toBe(200);
  });
});
