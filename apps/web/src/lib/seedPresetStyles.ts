import { db, captionStyles } from "@clip-panda/db";
import { PRESET_CAPTION_STYLES } from "@clip-panda/shared";

export async function seedPresetStyles(): Promise<void> {
  const existing = await db.select().from(captionStyles);
  if (existing.some((s) => s.isPreset)) {
    console.log("Preset caption styles already seeded, skipping.");
    return;
  }
  await db.insert(captionStyles).values(PRESET_CAPTION_STYLES);
  console.log(`Seeded ${PRESET_CAPTION_STYLES.length} preset caption styles.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPresetStyles().then(() => process.exit(0));
}
