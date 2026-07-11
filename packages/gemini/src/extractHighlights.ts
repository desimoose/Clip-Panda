import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export interface Highlight {
  timestampMs: number;
  captionText: string;
}

export function buildExtractHighlightsPrompt(count: number): string {
  return `You are helping a podcast creator build a "best moments" image
carousel spanning the whole episode.

Below is the full episode transcript as a JSON array of segments (each with
speakerLabel, startMs, endMs, text). Read it and pick exactly ${count}
distinct, standalone quote-worthy moments spread across the episode's full
runtime (do not cluster them all in one section unless the episode is very
short). Each moment should be a single strong sentence or short exchange that
makes sense on its own without surrounding context — a hot take, a surprising
stat, concise advice, or a memorable line.

Return ONLY a JSON array (no markdown fences, no commentary) where each
element has exactly this shape:

{
  "timestampMs": number,   // a timestamp within an existing segment's
                           // [startMs, endMs] range, at the moment the
                           // quoted line is spoken
  "captionText": string    // the exact quoted text to caption this slide with,
                           // trimmed to at most 140 characters
}

Rules:
- Exactly ${count} elements, ordered chronologically by timestampMs.
- No two timestamps within 5000ms of each other.
- captionText must be a verbatim (or lightly trimmed) quote from the
  transcript, not a paraphrase.

Transcript:
`;
}

export async function extractHighlights(
  segments: TranscriptSegment[],
  count: number
): Promise<Highlight[]> {
  const model = getGeminiModel();
  const result = await model.generateContent(
    buildExtractHighlightsPrompt(count) + JSON.stringify(segments)
  );

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as Highlight[];
  } catch {
    throw new Error(`failed to parse Gemini highlights response as JSON: ${raw.slice(0, 200)}`);
  }
}
