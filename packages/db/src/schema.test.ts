import { describe, it, expect } from "vitest";
import { episodes, slides, carousels } from "./schema.js";

describe("schema", () => {
  it("exposes the expected table columns", () => {
    expect(Object.keys(episodes)).toEqual(
      expect.arrayContaining(["id", "userId", "sourceType", "status"])
    );
    expect(Object.keys(carousels)).toEqual(
      expect.arrayContaining(["id", "episodeId", "mode", "captionStyleId"])
    );
    expect(Object.keys(slides)).toEqual(
      expect.arrayContaining(["id", "carouselId", "orderIndex", "status"])
    );
  });
});
