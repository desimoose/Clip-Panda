import { describe, it, expect } from "vitest";
import { renderOverlayPng } from "./overlay.js";
import { PRESET_CAPTION_STYLES } from "@clip-panda/shared";

describe("renderOverlayPng", () => {
  it("produces a non-empty PNG buffer", () => {
    const png = renderOverlayPng({
      width: 1920,
      height: 1080,
      captionText: "This is a test caption",
      style: PRESET_CAPTION_STYLES[0],
      watermarkText: "Clip Panda",
    });

    expect(png.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
