import { z } from "zod";

export const captionStyleSchema = z.object({
  name: z.string().min(1),
  isPreset: z.boolean(),
  font: z.string().min(1),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  highlightColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  size: z.number().int().min(16).max(120),
  position: z.enum(["top", "middle", "bottom"]),
});

export type CaptionStyleInput = z.infer<typeof captionStyleSchema>;

export const PRESET_CAPTION_STYLES: CaptionStyleInput[] = [
  {
    name: "Bold Yellow",
    isPreset: true,
    font: "Inter-Bold",
    textColor: "#FFFFFF",
    highlightColor: "#FFD700",
    size: 56,
    position: "bottom",
  },
  {
    name: "Minimal White",
    isPreset: true,
    font: "Inter-Regular",
    textColor: "#FFFFFF",
    highlightColor: "#FFFFFF",
    size: 44,
    position: "bottom",
  },
  {
    name: "Karaoke Pop",
    isPreset: true,
    font: "Inter-Bold",
    textColor: "#FFFFFF",
    highlightColor: "#FF3B30",
    size: 60,
    position: "middle",
  },
  {
    name: "Subtle Serif",
    isPreset: true,
    font: "PlayfairDisplay-Regular",
    textColor: "#F5F5F0",
    highlightColor: "#F5F5F0",
    size: 40,
    position: "bottom",
  },
];
