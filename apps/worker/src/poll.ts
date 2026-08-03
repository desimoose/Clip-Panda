export type Tick = () => Promise<void>;

export function runPollLoop(tick: Tick, intervalMs = 5000): { stop(): void } {
  let stopped = false;

  async function safeTick() {
    if (stopped) return;
    try {
      await tick();
    } catch (error) {
      console.error("poll tick failed:", error);
    }
  }

  safeTick();
  const handle = setInterval(safeTick, intervalMs);

  return {
    stop() {
      stopped = true;
      clearInterval(handle);
    },
  };
}
