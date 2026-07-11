# Clip Panda v1 — Design Spec

**Date**: 2026-07-11
**Status**: Approved, pending implementation plan

## Context

Clip Panda turns a podcast episode (video or audio) into a downloadable carousel
of annotated still images for social media (Instagram/LinkedIn-style carousel
posts). This is the **web app** half of the product — a separate team (AI
Studio) is building the Android app in parallel; this spec covers the web app
only, and the two are not expected to share a codebase.

This is v1: the smallest slice that proves the full pipeline (import → transcript
→ moment selection → rendered slide → gallery/export) works end-to-end. Several
adjacent ideas were deliberately deferred (see "Out of scope").

## Goals

- User can import a podcast episode (video upload, YouTube URL, direct video
  file URL, or audio-only file).
- User can generate a carousel of 10–20 still images, either as a sequential
  storyboard of one clip or as episode-wide highlight moments.
- Each slide shows the original video frame (unmodified — no cropping/face
  tracking) with the spoken line captioned on top, or, for audio-only sources, a
  generated text-on-background quote card.
- Caption appearance is controlled by 4 presets or a custom style (font, text
  color, highlight color, size, position).
- Every exported slide carries a small Clip Panda watermark (placeholder logo
  until the user supplies a real asset).
- User reviews slides in a gallery, can regenerate individual slides, and
  downloads the full set as a ZIP.
- Google sign-in scopes projects to a user. No billing/plans in v1.

## Non-goals (out of scope for v1)

- Rendering/exporting an actual video file — the product never outputs video,
  only images.
- Subscription plans, billing, usage limits/quotas.
- Per-speaker face detection, cropping, or split-screen layouts — slides use
  the frame exactly as filmed.
- A full drag-and-drop caption editor beyond the font/color/size/position
  controls described here.
- RSS/Spotify import — only YouTube URLs and direct video file URLs.
- More than 2 speakers, speaker name attribution in captions.
- Customizable watermark position/opacity (fixed bottom-right for v1).

## Architecture

- **Frontend + API**: Next.js 15 (App Router), TypeScript. Deployed on Vercel.
- **Auth**: Google sign-in via Auth.js. Every signed-in user has their own
  episodes/carousels; no roles or plans.
- **Database**: Postgres (Neon or Supabase).
- **Object storage**: S3-compatible bucket for source media, extracted frames,
  and rendered slide images.
- **Processing worker**: a separate long-running service (Fly.io or Modal), not
  Vercel functions — handles YouTube/URL fetch, ffmpeg frame extraction, and
  slide rendering, since these can exceed Vercel's execution time limits.
- **AI**: Gemini API (native audio/video understanding) for transcription,
  speaker diarization, clip-candidate suggestion, and highlight-moment
  extraction. Exact prompts per workflow are defined in the implementation
  plan, one per module.

## Data model (high level)

```
User
  id, google_id, email, created_at

Episode
  id, user_id, title, source_type (upload | youtube_url | direct_url | audio_only)
  source_uri, duration_seconds, status (importing|transcribing|ready|failed)
  created_at

Transcript
  id, episode_id, segments: [{ speaker_label, start_ms, end_ms, text, words: [{word,start_ms,end_ms}] }]

Carousel
  id, episode_id, mode (storyboard | highlights)
  clip_start_ms, clip_end_ms   -- only set when mode = storyboard
  caption_style_id, status (pending|rendering|ready|failed)
  created_at

CaptionStyle
  id, carousel_id (nullable if it's a reusable preset), name
  is_preset (bool), font, text_color, highlight_color, size, position

Slide
  id, carousel_id, order_index, timestamp_ms (null for audio-only quote cards)
  image_url, caption_text, status (pending|rendered|failed)
```

## Module workflows

Each module below is a distinct unit with a defined input/output boundary. The
implementation plan will give each its own file(s) and, where it calls Gemini,
the literal prompt text.

1. **Import** — accepts upload, YouTube URL, or direct video URL; audio-only
   files skip video-specific steps. Produces a stored source media file and an
   `Episode` row.
2. **Transcription & Diarization** — sends media to Gemini, gets back
   word-level timestamped transcript with speaker labels. Produces a
   `Transcript`.
3. **Clip Candidate Suggestion** (storyboard mode) — Gemini proposes candidate
   clip ranges; user fine-tunes via the word-level transcript UI.
4. **Highlight Extraction** (highlights mode) — Gemini scans the full
   transcript and picks 10–20 standalone quote-worthy moments with timestamps.
5. **Frame Sampling** (storyboard mode, video only) — ffmpeg extracts evenly
   spaced frames across the chosen clip range.
6. **Slide Rendering** — overlays caption text (per the chosen `CaptionStyle`)
   and the watermark onto either an extracted frame (video) or a generated
   background (audio-only quote card). Same renderer, different background
   source.
7. **Gallery & Export** — displays all slides for a carousel, supports
   regenerating one slide, and bundles all slide images into a ZIP for
   download.
8. **Auth** — Google sign-in via Auth.js; scopes all the above to the signed-in
   user.

## Caption styling

4 presets (Bold Yellow, Minimal White, Karaoke Pop, Subtle Serif) plus a
Custom option exposing: font, text color, highlight color, size, position
(top/middle/bottom). Selected once per carousel and applied to all its slides;
stored as a `CaptionStyle` row so it can be reused or copied.

## Watermark

Fixed bottom-right placement, fixed size/opacity, placeholder Clip Panda mark
shipped in v1. Swapping in the real logo is a config/asset change, not a code
change.

## Error handling

- Import failures (bad URL, unsupported format, download blocked) mark the
  `Episode` as `failed` with a user-visible reason.
- Gemini failures (transcription or extraction) are retried once
  automatically, then surfaced to the user with a retry action.
- Individual slide render failures don't block the rest of the carousel — the
  gallery shows a per-slide "failed, retry" state.

## Testing approach

- Unit tests for the slide renderer (given a frame + caption style + text, is
  the overlay positioned/styled correctly) and for the ZIP export bundler.
- Integration test for the full pipeline against a short fixture video
  (import → transcript → highlight extraction → rendered slides), using a
  mocked Gemini response to keep it deterministic.
- Manual verification in-browser for the two rendering paths (video frame vs.
  audio-only quote card) and both carousel modes, per the `webapp-testing`
  workflow before calling any module done.
