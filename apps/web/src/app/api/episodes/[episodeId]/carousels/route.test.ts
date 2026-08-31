import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

const insertedSlides: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      episodes: {
        findFirst: vi.fn().mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", userId: "user-1" }),
      },
      transcripts: {
        findFirst: vi.fn().mockResolvedValue({
          segments: [
            { speakerLabel: "Speaker A", startMs: 0, endMs: 30000, text: "the first half", words: [] },
            { speakerLabel: "Speaker A", startMs: 30000, endMs: 60000, text: "the second half", words: [] },
          ],
        }),
      },
    },
    insert: (table: any) => ({
      values: (rowOrRows: any) => ({
        returning: async () => {
          if (Array.isArray(rowOrRows)) {
            insertedSlides.push(...rowOrRows);
            return rowOrRows.map((r, i) => ({ id: `slide-${i}`, ...r }));
          }
          return [{ id: "carousel-1", ...rowOrRows }];
        },
      }),
    }),
  },
  episodes: {},
  carousels: {},
  slides: {},
  transcripts: {},
}));

import { POST } from "./route.js";

const STYLE_ID = "00000000-0000-0000-0000-000000000001";

describe("POST /api/episodes/:episodeId/carousels", () => {
  it("creates a highlights-mode carousel with one slide per highlight", async () => {
    const highlights = Array.from({ length: 10 }, (_, i) => ({
      timestampMs: (i + 1) * 1000,
      captionText: ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][i],
    }));

    const request = new Request("http://localhost/api/episodes/11111111-1111-1111-1111-111111111111/carousels", {
      method: "POST",
      body: JSON.stringify({
        mode: "highlights",
        captionStyleId: STYLE_ID,
        highlights,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ episodeId: "11111111-1111-1111-1111-111111111111" }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.carouselId).toBe("carousel-1");
    expect(insertedSlides).toHaveLength(10);
    expect(insertedSlides[0].orderIndex).toBe(0);
    expect(insertedSlides[1].captionText).toBe("second");
  });

  it("creates a storyboard-mode carousel, sampling timestamps and looking up captions from the transcript", async () => {
    insertedSlides.length = 0;
    const request = new Request("http://localhost/api/episodes/11111111-1111-1111-1111-111111111111/carousels", {
      method: "POST",
      body: JSON.stringify({
        mode: "storyboard",
        captionStyleId: STYLE_ID,
        clipStartMs: 0,
        clipEndMs: 60000,
        slideCount: 10,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ episodeId: "11111111-1111-1111-1111-111111111111" }) });
    expect(response.status).toBe(201);
    expect(insertedSlides).toHaveLength(10);
    // sampleFrameTimestamps(0, 60000, 10) -> [0,6000,12000,18000,24000,30000,36000,...]
    // index 0 (ts 0) falls in the first segment; index 6 (ts 36000) falls in the second segment
    // (ts 30000 is <= segment 0's endMs, so it stays in the first segment).
    expect(insertedSlides[0].captionText).toBe("the first half");
    expect(insertedSlides[6].captionText).toBe("the second half");
  });

  it("rejects storyboard mode missing clip range", async () => {
    const request = new Request("http://localhost/api/episodes/11111111-1111-1111-1111-111111111111/carousels", {
      method: "POST",
      body: JSON.stringify({ mode: "storyboard", captionStyleId: STYLE_ID }),
    });
    const response = await POST(request, { params: Promise.resolve({ episodeId: "11111111-1111-1111-1111-111111111111" }) });
    expect(response.status).toBe(400);
  });
});
