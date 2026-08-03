export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
}
