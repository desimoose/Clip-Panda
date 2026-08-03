import { Resvg } from "@resvg/resvg-js";
import type { CaptionStyleInput } from "@clip-panda/shared";

export interface RenderOverlayOptions {
  width: number;
  height: number;
  captionText: string;
  style: CaptionStyleInput;
  watermarkText: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > maxCharsPerLine && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function yForPosition(position: CaptionStyleInput["position"], height: number, blockHeight: number): number {
  if (position === "top") return blockHeight;
  if (position === "middle") return height / 2 - blockHeight / 2 + blockHeight;
  return height - blockHeight - 40;
}

export function renderOverlayPng(options: RenderOverlayOptions): Buffer {
  const { width, height, captionText, style, watermarkText } = options;
  const lines = wrapText(captionText, 40);
  const lineHeight = style.size * 1.3;
  const blockHeight = lines.length * lineHeight;
  const startY = yForPosition(style.position, height, blockHeight);

  const captionLines = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="${width / 2}" y="${y}" font-family="${style.font}" font-size="${style.size}" fill="${style.textColor}" stroke="${style.highlightColor}" stroke-width="${style.size * 0.05}" paint-order="stroke" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${captionLines}
    <text x="${width - 24}" y="${height - 24}" font-family="Inter-Bold" font-size="28" fill="#FFFFFF" fill-opacity="0.85" text-anchor="end">${escapeXml(watermarkText)}</text>
  </svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return resvg.render().asPng();
}
