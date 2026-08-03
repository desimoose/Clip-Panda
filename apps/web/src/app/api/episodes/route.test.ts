import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@clip-panda/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue("episodes/ep-1/source.mp4"),
}));

const insertedRows: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          const withId = { id: "ep-1", ...row };
          insertedRows.push(withId);
          return [withId];
        },
      }),
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  },
  episodes: {},
}));

import { POST } from "./route.js";

beforeEach(() => insertedRows.length === 0);

describe("POST /api/episodes", () => {
  it("creates an episode from an uploaded file", async () => {
    const form = new FormData();
    form.append("title", "My Episode");
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "source.mp4", { type: "video/mp4" })
    );
    const request = new Request("http://localhost/api/episodes", {
      method: "POST",
      body: form,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.episodeId).toBe("ep-1");
  });

  it("rejects requests with no signed-in user", async () => {
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValueOnce(null);

    const form = new FormData();
    form.append("title", "x");
    form.append("file", new File([new Uint8Array([1])], "x.mp4", { type: "video/mp4" }));
    const request = new Request("http://localhost/api/episodes", {
      method: "POST",
      body: form,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
