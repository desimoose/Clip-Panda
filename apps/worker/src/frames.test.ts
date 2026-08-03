import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => cb(null, "", ""),
}));

import { extractFrame } from "./frames.js";

describe("extractFrame", () => {
  it("resolves without throwing when ffmpeg succeeds", async () => {
    await expect(
      extractFrame("/tmp/source.mp4", 2000, "/tmp/frame-2000.png")
    ).resolves.toBeUndefined();
  });
});
