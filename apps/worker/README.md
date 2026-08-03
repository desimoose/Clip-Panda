# Clip Panda Worker

Polls Postgres for pending episodes/carousels/slides and processes them
(URL fetch, transcription, frame sampling, slide rendering).

**YouTube import caveat:** downloading video via `yt-dlp` from YouTube URLs
may violate YouTube's Terms of Service unless the uploader has granted
rights or you are using an authorized API. This was a known, accepted
tradeoff when this feature was scoped (see
`docs/superpowers/specs/2026-07-11-clip-panda-v1-design.md`) — revisit
before scaling beyond personal/internal use.

**Requires on PATH:** `yt-dlp`, `ffmpeg` (bundled via `ffmpeg-static` for
frame extraction, but `yt-dlp` must be installed separately in the
worker's runtime image).
