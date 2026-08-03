import { describe, it, expect, vi } from "vitest";

const dbState = {
  episode: { id: "ep-1", sourceUri: "episodes/ep-1/source.mp4", status: "transcribing" },
  insertedTranscript: null as any,
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: { episodes: { findFirst: vi.fn().mockImplementation(async () => dbState.episode) } },
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          dbState.insertedTranscript = row;
          return [{ id: "t-1", ...row }];
        },
      }),
    }),
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.episode, patch);
        },
      }),
    }),
  },
  episodes: {},
  transcripts: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake video")),
}));

vi.mock("@clip-panda/gemini", () => ({
  transcribeMedia: vi.fn().mockResolvedValue([
    { speakerLabel: "Speaker A", startMs: 0, endMs: 1000, text: "hi", words: [] },
  ]),
}));

import { transcribeEpisode } from "./transcribeEpisode.js";

describe("transcribeEpisode", () => {
  it("stores the transcript and marks the episode ready", async () => {
    await transcribeEpisode("ep-1");
    expect(dbState.insertedTranscript.episodeId).toBe("ep-1");
    expect(dbState.episode.status).toBe("ready");
  });
});
