import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { extractHighlights } from "./extractHighlights.js";

describe("extractHighlights", () => {
  it("parses Gemini's highlight list", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { timestampMs: 251000, captionText: "the surprising stat about churn" },
          ]),
      },
    });

    const highlights = await extractHighlights(
      [{ speakerLabel: "Speaker A", startMs: 0, endMs: 300000, text: "...", words: [] }],
      15
    );

    expect(highlights).toEqual([
      { timestampMs: 251000, captionText: "the surprising stat about churn" },
    ]);
  });
});
