import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { suggestClipCandidates } from "./suggestClips.js";

describe("suggestClipCandidates", () => {
  it("parses Gemini's candidate list", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { startMs: 12000, endMs: 45000, reason: "hot take about AI jobs" },
          ]),
      },
    });

    const candidates = await suggestClipCandidates([
      { speakerLabel: "Speaker A", startMs: 0, endMs: 60000, text: "...", words: [] },
    ]);

    expect(candidates).toEqual([
      { startMs: 12000, endMs: 45000, reason: "hot take about AI jobs" },
    ]);
  });
});
