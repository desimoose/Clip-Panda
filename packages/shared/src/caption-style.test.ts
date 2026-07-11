import { describe, it, expect } from "vitest";
import { captionStyleSchema, PRESET_CAPTION_STYLES } from "./caption-style.js";

describe("captionStyleSchema", () => {
  it("accepts a valid custom style", () => {
    const result = captionStyleSchema.safeParse({
      name: "My Style",
      isPreset: false,
      font: "Inter",
      textColor: "#FFFFFF",
      highlightColor: "#FFD700",
      size: 48,
      position: "bottom",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid position", () => {
    const result = captionStyleSchema.safeParse({
      name: "Bad",
      isPreset: false,
      font: "Inter",
      textColor: "#FFFFFF",
      highlightColor: "#FFD700",
      size: 48,
      position: "diagonal",
    });
    expect(result.success).toBe(false);
  });

  it("ships exactly 4 presets", () => {
    expect(PRESET_CAPTION_STYLES).toHaveLength(4);
    expect(PRESET_CAPTION_STYLES.map((s) => s.name)).toEqual([
      "Bold Yellow",
      "Minimal White",
      "Karaoke Pop",
      "Subtle Serif",
    ]);
  });
});
