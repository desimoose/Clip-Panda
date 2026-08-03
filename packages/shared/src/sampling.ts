import type { TranscriptSegment } from "./transcript.js";

export function sampleFrameTimestamps(startMs: number, endMs: number, count: number): number[] {
  const step = (endMs - startMs) / count;
  return Array.from({ length: count }, (_, i) => Math.round(startMs + i * step));
}

export function findCaptionForTimestamp(
  segments: TranscriptSegment[],
  timestampMs: number
): string {
  if (segments.length === 0) return "";

  const containing = segments.find((s) => timestampMs >= s.startMs && timestampMs <= s.endMs);
  if (containing) return containing.text;

  const nearest = segments.reduce((closest, s) => {
    const distance = Math.min(Math.abs(s.startMs - timestampMs), Math.abs(s.endMs - timestampMs));
    const closestDistance = Math.min(
      Math.abs(closest.startMs - timestampMs),
      Math.abs(closest.endMs - timestampMs)
    );
    return distance < closestDistance ? s : closest;
  });

  return nearest.text;
}
