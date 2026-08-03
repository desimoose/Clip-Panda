import { describe, it, expect } from "vitest";
import { sampleFrameTimestamps, findCaptionForTimestamp } from "./sampling.js";

describe("sampleFrameTimestamps", () => {
  it("returns `count` evenly spaced timestamps starting at startMs", () => {
    expect(sampleFrameTimestamps(0, 10000, 5)).toEqual([0, 2000, 4000, 6000, 8000]);
  });
});

describe("findCaptionForTimestamp", () => {
  const segments = [
    { speakerLabel: "Speaker A", startMs: 0, endMs: 5000, text: "first segment", words: [] },
    { speakerLabel: "Speaker B", startMs: 5000, endMs: 10000, text: "second segment", words: [] },
  ];

  it("returns the text of the segment containing the timestamp", () => {
    expect(findCaptionForTimestamp(segments, 6000)).toBe("second segment");
  });

  it("falls back to the nearest segment when no segment contains the timestamp", () => {
    expect(findCaptionForTimestamp(segments, 10500)).toBe("second segment");
  });

  it("returns an empty string for an empty segment list", () => {
    expect(findCaptionForTimestamp([], 1000)).toBe("");
  });
});
