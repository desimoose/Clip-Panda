import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export const TRANSCRIBE_PROMPT = `You are transcribing a podcast recording for a clipping tool.

Listen to the attached media in full and return ONLY a JSON array (no markdown
fences, no commentary) of transcript segments, one per continuous utterance by
a single speaker. Each element must have exactly this shape:

{
  "speakerLabel": string,   // "Speaker A", "Speaker B", etc. Use a stable label
                            // per distinct voice for the whole file.
  "startMs": number,        // segment start time in milliseconds from file start
  "endMs": number,          // segment end time in milliseconds from file start
  "text": string,           // the full text spoken in this segment
  "words": [
    { "word": string, "startMs": number, "endMs": number }
    // one entry per word, in order, covering the full segment duration.
    // Word timestamps must be monotonically increasing and fall within
    // [startMs, endMs] of the parent segment.
  ]
}

Rules:
- Identify distinct speakers by voice; if you cannot tell speakers apart,
  label everything "Speaker A".
- Do not merge two speakers' words into one segment.
- Do not skip filler words ("um", "yeah", "so") — include them, they matter
  for caption timing.
- If the file is silent or unintelligible for a stretch, do not fabricate
  text for that stretch — simply omit it.
- Return strictly valid JSON. No trailing commas. No text before or after
  the array.`;

export async function transcribeMedia(
  mediaBuffer: Buffer,
  mimeType: string
): Promise<TranscriptSegment[]> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    { text: TRANSCRIBE_PROMPT },
    { inlineData: { data: mediaBuffer.toString("base64"), mimeType } },
  ]);

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as TranscriptSegment[];
  } catch {
    throw new Error(`failed to parse Gemini transcription response as JSON: ${raw.slice(0, 200)}`);
  }
}
