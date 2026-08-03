import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { TranscriptSegment } from "@clip-panda/shared";

export const episodeSourceType = pgEnum("episode_source_type", [
  "upload",
  "youtube_url",
  "direct_url",
  "audio_only",
]);

export const episodeStatus = pgEnum("episode_status", [
  "importing",
  "transcribing",
  "ready",
  "failed",
]);

export const carouselMode = pgEnum("carousel_mode", ["storyboard", "highlights"]);

export const carouselStatus = pgEnum("carousel_status", [
  "pending",
  "rendering",
  "ready",
  "failed",
]);

export const slideStatus = pgEnum("slide_status", ["pending", "rendered", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  sourceType: episodeSourceType("source_type").notNull(),
  sourceUri: text("source_uri").notNull(),
  durationSeconds: integer("duration_seconds"),
  status: episodeStatus("status").notNull().default("importing"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  episodeId: uuid("episode_id").notNull().references(() => episodes.id),
  segments: jsonb("segments").$type<TranscriptSegment[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const captionStyles = pgTable("caption_styles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isPreset: boolean("is_preset").notNull().default(false),
  font: text("font").notNull(),
  textColor: text("text_color").notNull(),
  highlightColor: text("highlight_color").notNull(),
  size: integer("size").notNull(),
  position: text("position", { enum: ["top", "middle", "bottom"] }).notNull(),
});

export const carousels = pgTable("carousels", {
  id: uuid("id").primaryKey().defaultRandom(),
  episodeId: uuid("episode_id").notNull().references(() => episodes.id),
  mode: carouselMode("mode").notNull(),
  clipStartMs: integer("clip_start_ms"),
  clipEndMs: integer("clip_end_ms"),
  captionStyleId: uuid("caption_style_id").notNull().references(() => captionStyles.id),
  status: carouselStatus("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const slides = pgTable("slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  carouselId: uuid("carousel_id").notNull().references(() => carousels.id),
  orderIndex: integer("order_index").notNull(),
  timestampMs: integer("timestamp_ms"),
  captionText: text("caption_text").notNull(),
  imageUrl: text("image_url"),
  status: slideStatus("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
});
