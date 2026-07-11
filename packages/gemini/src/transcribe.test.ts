import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { transcribeMedia } from "./transcribe.js";

describe("transcribeMedia", () => {
  it("parses Gemini's JSON response into TranscriptSegments", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            {
              speakerLabel: "Speaker A",
              startMs: 0,
              endMs: 2000,
              text: "hello there",
              words: [
                { word: "hello", startMs: 0, endMs: 900 },
                { word: "there", startMs: 900, endMs: 2000 },
              ],
            },
          ]),
      },
    });

    const segments = await transcribeMedia(Buffer.from("fake"), "video/mp4");

    expect(segments).toHaveLength(1);
    expect(segments[0].speakerLabel).toBe("Speaker A");
    expect(segments[0].words).toHaveLength(2);
  });

  it("throws a clear error if Gemini returns non-JSON", async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => "not json" } });
    await expect(transcribeMedia(Buffer.from("fake"), "video/mp4")).rejects.toThrow(
      /failed to parse/i
    );
  });
});
