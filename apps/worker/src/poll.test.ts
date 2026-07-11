import { describe, it, expect, vi } from "vitest";
import { runPollLoop } from "./poll.js";

describe("runPollLoop", () => {
  it("calls tick immediately and then on each interval, until stopped", async () => {
    vi.useFakeTimers();
    const tick = vi.fn().mockResolvedValue(undefined);

    const loop = runPollLoop(tick, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);

    loop.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(tick).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
