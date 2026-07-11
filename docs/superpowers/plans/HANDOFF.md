# Clip Panda — Build Handoff Prompt

Paste the prompt below into your coding agent (OpenCode, Claude Code, etc.)
after cloning `https://github.com/desimoose/Clip-Panda` and completing the
prerequisites checklist further down.

---

## Prompt to paste

```
You are implementing Clip Panda, a web app that turns a podcast episode
(video or audio) into a downloadable carousel of annotated still images for
social media. Two documents in this repo define everything you need:

1. docs/superpowers/specs/2026-07-11-clip-panda-v1-design.md — the design
   spec (what we're building and why, architecture, data model, non-goals).
2. docs/superpowers/plans/2026-07-11-clip-panda-v1.md — the implementation
   plan, broken into 19 tasks in dependency order. Each task lists exact
   file paths, complete code (including the literal Gemini prompts for
   transcription/diarization, clip-candidate suggestion, and highlight
   extraction), a test-first (red/green) step sequence, and a commit step.

Read both documents in full before writing any code.

Then execute the plan task by task, in order (Task 1 through Task 19):
- For each task, follow its steps literally: write the failing test first,
  run it to confirm it fails, write the implementation exactly as specified
  (the plan's code is complete and meant to be used as-is, not paraphrased),
  run the test to confirm it passes, then commit with the message given in
  that step.
- Do not skip ahead or merge tasks — later tasks depend on exact type names,
  function signatures, and file paths established in earlier ones (e.g.
  `sampleFrameTimestamps` and `findCaptionForTimestamp` are defined once in
  packages/shared in Task 13 and reused by both the worker and the web app;
  don't redefine them elsewhere).
- If a step's expected output doesn't match what you get, stop and
  investigate before moving on — don't paper over a failing test.
- After finishing all 19 tasks, do the manual end-to-end verification
  described in Task 19 Step 5 (import a short test video, generate a
  carousel, confirm the gallery renders and the ZIP download works) before
  declaring this done.

Ask me before making any change to the plan's architecture or scope — if you
think a task should be done differently, say so and wait for a decision
rather than silently deviating.
```

---

## Prerequisites checklist (do these before starting)

The plan assumes these exist and their credentials are available as
environment variables. Nothing in the plan will run without them.

- [ ] **Postgres database** — e.g. a free Neon or Supabase project. You need
      the connection string for `DATABASE_URL`.
- [ ] **S3-compatible object storage** — e.g. Cloudflare R2 (has a free
      tier) or AWS S3. You need `S3_ENDPOINT` (omit for real AWS S3),
      `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- [ ] **Google OAuth credentials** — create an OAuth Client ID in Google
      Cloud Console (APIs & Services → Credentials), type "Web application",
      authorized redirect URI `http://localhost:3000/api/auth/callback/google`
      for local dev. You need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- [ ] **Auth.js secret** — generate one locally with `npx auth secret` (or
      any random 32+ byte string) for `AUTH_SECRET`.
- [ ] **Gemini API key** — from Google AI Studio. You need `GEMINI_API_KEY`.
- [ ] **yt-dlp installed** on whatever machine/container runs the worker
      (`apps/worker`) — required for YouTube URL import (Task 7). Not an
      npm package; install it as a system binary.
- [ ] **Node.js 20+ and pnpm 9+** installed locally.

Put the web app's env vars in `apps/web/.env.local` and the worker's in
`apps/worker/.env` (both are git-ignored per Task 1's `.gitignore`) — see
Task 4 Step 3 and Task 9's `GEMINI_API_KEY` usage in the plan for exactly
which vars each app reads.

## Where things stand right now

- GitHub repo: https://github.com/desimoose/Clip-Panda (private), `main`
  branch has one commit with the spec + plan docs only — no code yet.
- Nothing has been scaffolded locally beyond `docs/`. Task 1 of the plan
  starts from an empty project.
