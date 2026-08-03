import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFile = promisify(execFileCb);

export async function extractFrame(
  videoPath: string,
  timestampMs: number,
  outputPath: string
): Promise<void> {
  const timestampSeconds = (timestampMs / 1000).toFixed(3);
  await execFile(ffmpegPath as string, [
    "-y",
    "-ss",
    timestampSeconds,
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}
