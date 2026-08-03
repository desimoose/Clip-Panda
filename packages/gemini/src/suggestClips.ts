import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export interface ClipCandidate {
  startMs: number;
  endMs: number;
  reason: string;
}

export const SUGGEST_CLIPS_PROMPT = `You are helping a podcast creator pick a
single continuous clip (30-90 seconds) to turn into a still-image carousel
for social media.

Below is the full episode transcript as a JSON array of segments (each with
speakerLabel, startMs, endMs, text). Read it and propose 3-6 candidate clip
ranges that would work well as a standalone, self-contained moment — it
should make sense to someone with no other context, have a clear beginning
and end, and be emotionally or intellectually engaging (a strong opinion, a
surprising fact, a funny exchange, useful advice).

Return ONLY a JSON array (no markdown fences, no commentary) where each
element has exactly this shape:

{
  "startMs": number,  // must align with a segment boundary in the transcript
  "endMs": number,    // must be startMs + between 30000 and 90000
  "reason": string    // one short sentence explaining why this moment works
}

Rules:
- Ranges must not overlap.
- Order the array from strongest to weakest candidate.
- Do not invent timestamps outside the transcript's covered range.

Transcript:
`;

export async function suggestClipCandidates(
  segments: TranscriptSegment[]
): Promise<ClipCandidate[]> {
  const model = getGeminiModel();
  const result = await model.generateContent(
    SUGGEST_CLIPS_PROMPT + JSON.stringify(segments)
  );

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as ClipCandidate[];
  } catch {
    throw new Error(`failed to parse Gemini clip-candidate response as JSON: ${raw.slice(0, 200)}`);
  }
}
