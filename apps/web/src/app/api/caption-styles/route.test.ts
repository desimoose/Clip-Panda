import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

const inserted: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    select: () => ({ from: () => Promise.resolve([{ id: "preset-1", name: "Bold Yellow", isPreset: true }]) }),
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          const withId = { id: "custom-1", ...row };
          inserted.push(withId);
          return [withId];
        },
      }),
    }),
  },
  captionStyles: {},
}));

import { GET, POST } from "./route.js";

describe("GET /api/caption-styles", () => {
  it("returns existing styles", async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.styles).toEqual([{ id: "preset-1", name: "Bold Yellow", isPreset: true }]);
  });
});

describe("POST /api/caption-styles", () => {
  it("creates a custom style and forces isPreset false", async () => {
    const request = new Request("http://localhost/api/caption-styles", {
      method: "POST",
      body: JSON.stringify({
        name: "My Style",
        isPreset: true,
        font: "Inter",
        textColor: "#FFFFFF",
        highlightColor: "#FFD700",
        size: 48,
        position: "bottom",
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.style.isPreset).toBe(false);
  });

  it("rejects an invalid body", async () => {
    const request = new Request("http://localhost/api/caption-styles", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
