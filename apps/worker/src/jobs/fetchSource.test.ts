import { describe, it, expect, vi } from "vitest";

const dbState = {
  episode: {
    id: "ep-1",
    sourceType: "youtube_url",
    sourceUri: "https://youtube.com/watch?v=abc123",
    status: "importing",
  },
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      episodes: {
        findFirst: vi.fn().mockImplementation(async () => dbState.episode),
      },
    },
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.episode, patch);
        },
      }),
    }),
  },
  episodes: {},
}));

vi.mock("@clip-panda/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue("episodes/ep-1/source.mp4"),
}));

vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => cb(null, "", ""),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake video bytes")),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { fetchSourceForEpisode } from "./fetchSource.js";

describe("fetchSourceForEpisode", () => {
  it("downloads the source and marks the episode transcribing", async () => {
    await fetchSourceForEpisode("ep-1");
    expect(dbState.episode.status).toBe("transcribing");
  });
});
