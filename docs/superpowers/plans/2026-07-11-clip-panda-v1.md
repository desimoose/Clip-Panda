# Clip Panda v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Clip Panda web app v1 — import a podcast episode, generate a 10-20 slide image carousel (storyboard or highlights mode) with captions and a watermark, review in a gallery, and download as a ZIP.

**Architecture:** pnpm monorepo. `apps/web` is a Next.js 15 app (UI + fast API routes: auth, episode creation, caption styles, carousel creation, gallery, ZIP export). `apps/worker` is a long-running Node service that polls Postgres for pending work (URL fetch, transcription, frame sampling, slide rendering) — no HTTP contract between web and worker, they coordinate purely through DB row status. `packages/db` (Drizzle schema/client), `packages/shared` (Zod schemas/types), `packages/storage` (S3 client), `packages/gemini` (Gemini prompts/client), and `packages/render` (SVG/sharp slide renderer) are shared by both apps.

**Tech Stack:** Next.js 15 + TypeScript + React 19, next-auth v5 (Google provider), Drizzle ORM + Postgres (`postgres` driver), `@aws-sdk/client-s3` (S3-compatible storage), `@google/generative-ai` (Gemini), `@resvg/resvg-js` + `sharp` (text overlay rendering), `ffmpeg-static` (frame extraction), `yt-dlp` binary (YouTube fetch), `archiver` (ZIP export), Vitest (testing), pnpm workspaces.

## Global Constraints

- Output is images only — no code path may produce or export a video file (spec: Non-goals).
- Slides are 16:9 landscape; video slides use the original frame uncropped (no face detection/cropping).
- No billing/plans/usage limits in v1 — every authenticated user has unlimited access to their own data.
- Every rendered slide gets the fixed bottom-right watermark — this is not optional per-slide.
- Caption style is chosen once per carousel and applied to every slide in it.
- Worker and web coordinate only through Postgres row status (`pending` → `processing` → `ready`/`failed`) — never add a direct HTTP call between them.

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`
- Create: `packages/db/package.json`, `packages/shared/package.json`, `packages/storage/package.json`, `packages/gemini/package.json`, `packages/render/package.json` (each a minimal TS package)

**Interfaces:**
- Produces: workspace layout `apps/{web,worker}` and `packages/{db,shared,storage,gemini,render}`, each an independent pnpm workspace package importable as `@clip-panda/<name>`.

- [ ] **Step 1: Initialize git and root package.json**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda"
git init
```

Create `package.json`:

```json
{
  "name": "clip-panda",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev:web": "pnpm --filter @clip-panda/web dev",
    "dev:worker": "pnpm --filter @clip-panda/worker dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "composite": true
  }
}
```

Create `.gitignore`:

```
node_modules
.next
dist
*.env
*.env.local
.turbo
```

- [ ] **Step 2: Scaffold packages/db**

Create `packages/db/package.json`:

```json
{
  "name": "@clip-panda/db",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Create `packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Scaffold packages/shared, packages/storage, packages/gemini, packages/render**

Each gets the same shape. Create `packages/shared/package.json`:

```json
{
  "name": "@clip-panda/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

Create `packages/storage/package.json`:

```json
{
  "name": "@clip-panda/storage",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.658.0",
    "@aws-sdk/s3-request-presigner": "^3.658.0"
  },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

Create `packages/gemini/package.json`:

```json
{
  "name": "@clip-panda/gemini",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@clip-panda/shared": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

Create `packages/render/package.json`:

```json
{
  "name": "@clip-panda/render",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@resvg/resvg-js": "^2.6.2",
    "sharp": "^0.33.5",
    "@clip-panda/shared": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

Add matching `tsconfig.json` (same content as Step 2's) to each of `packages/shared`, `packages/storage`, `packages/gemini`, `packages/render`.

- [ ] **Step 4: Scaffold apps/web with Next.js 15**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps"
pnpm create next-app@latest web --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm
```

When prompted, decline ESLint's strict extras if asked (defaults are fine). After scaffolding, edit `apps/web/package.json` to add workspace dependencies:

```json
{
  "dependencies": {
    "@clip-panda/db": "workspace:*",
    "@clip-panda/shared": "workspace:*",
    "@clip-panda/storage": "workspace:*",
    "@clip-panda/gemini": "workspace:*"
  }
}
```

- [ ] **Step 5: Scaffold apps/worker as a plain Node service**

Create `apps/worker/package.json`:

```json
{
  "name": "@clip-panda/worker",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@clip-panda/db": "workspace:*",
    "@clip-panda/shared": "workspace:*",
    "@clip-panda/storage": "workspace:*",
    "@clip-panda/gemini": "workspace:*",
    "@clip-panda/render": "workspace:*",
    "ffmpeg-static": "^5.2.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

Create `apps/worker/tsconfig.json` (same content as Step 2's, but `"outDir": "dist"` added under `compilerOptions`).

Create a placeholder `apps/worker/src/index.ts`:

```typescript
console.log("worker booting...");
```

- [ ] **Step 6: Install and verify the workspace builds**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda"
pnpm install
pnpm -r typecheck
```

Expected: no errors (packages have no source files yet beyond the worker
placeholder, so typecheck should pass trivially).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with web, worker, and shared packages"
```

---

## Task 2: Database schema (packages/db)

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/drizzle.config.ts`
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle client instance), and tables `users`, `episodes`, `transcripts`, `carousels`, `captionStyles`, `slides` exported from `@clip-panda/db`. Exact column names below are relied on by every later task — do not rename without updating this plan.

- [ ] **Step 1: Write the schema**

Create `packages/db/src/schema.ts`:

```typescript
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

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
}

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
```

- [ ] **Step 2: Write the Drizzle client**

Create `packages/db/src/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export const db = createDb();
export type Db = ReturnType<typeof createDb>;
```

Create `packages/db/src/index.ts`:

```typescript
export * from "./schema.js";
export * from "./client.js";
```

- [ ] **Step 3: Write drizzle-kit config for migrations**

Create `packages/db/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Write a schema smoke test**

Create `packages/db/src/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { episodes, slides, carousels } from "./schema.js";

describe("schema", () => {
  it("exposes the expected table columns", () => {
    expect(Object.keys(episodes)).toEqual(
      expect.arrayContaining(["id", "userId", "sourceType", "status"])
    );
    expect(Object.keys(carousels)).toEqual(
      expect.arrayContaining(["id", "episodeId", "mode", "captionStyleId"])
    );
    expect(Object.keys(slides)).toEqual(
      expect.arrayContaining(["id", "carouselId", "orderIndex", "status"])
    );
  });
});
```

- [ ] **Step 5: Run the test**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\db"
pnpm test
```

Expected: PASS (this only checks JS object shape, no DB connection required).

- [ ] **Step 6: Generate and apply the initial migration**

Requires a real `DATABASE_URL` (Neon/Supabase connection string) in
`packages/db/.env`:

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\db"
pnpm drizzle-kit generate
DATABASE_URL="<your-connection-string>" pnpm drizzle-kit migrate
```

Expected: a new file under `packages/db/migrations/` and the tables created
in your Postgres instance (verify with `\dt` in `psql` or your DB provider's
table browser).

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): add Drizzle schema for users, episodes, transcripts, carousels, slides"
```

---

## Task 3: Shared Zod schemas (packages/shared)

**Files:**
- Create: `packages/shared/src/caption-style.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/caption-style.test.ts`

**Interfaces:**
- Consumes: nothing (leaf package)
- Produces: `CaptionStyleInput` type + `captionStyleSchema` Zod schema, `PRESET_CAPTION_STYLES` array of 4 presets, used by Task 12 (caption style API) and Task 19 (frontend picker).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/caption-style.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { captionStyleSchema, PRESET_CAPTION_STYLES } from "./caption-style.js";

describe("captionStyleSchema", () => {
  it("accepts a valid custom style", () => {
    const result = captionStyleSchema.safeParse({
      name: "My Style",
      isPreset: false,
      font: "Inter",
      textColor: "#FFFFFF",
      highlightColor: "#FFD700",
      size: 48,
      position: "bottom",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid position", () => {
    const result = captionStyleSchema.safeParse({
      name: "Bad",
      isPreset: false,
      font: "Inter",
      textColor: "#FFFFFF",
      highlightColor: "#FFD700",
      size: 48,
      position: "diagonal",
    });
    expect(result.success).toBe(false);
  });

  it("ships exactly 4 presets", () => {
    expect(PRESET_CAPTION_STYLES).toHaveLength(4);
    expect(PRESET_CAPTION_STYLES.map((s) => s.name)).toEqual([
      "Bold Yellow",
      "Minimal White",
      "Karaoke Pop",
      "Subtle Serif",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\shared"
pnpm test
```

Expected: FAIL with "Cannot find module './caption-style.js'"

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/caption-style.ts`:

```typescript
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
```

Create `packages/shared/src/index.ts`:

```typescript
export * from "./caption-style.js";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add caption style schema and 4 presets"
```

---

## Task 4: Google Auth (apps/web)

**Files:**
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Modify: `apps/web/.env.local` (add secrets, not committed)
- Test: `apps/web/src/auth.test.ts`

**Interfaces:**
- Consumes: `db`, `users` table from `@clip-panda/db`.
- Produces: `auth()` helper (returns the current session or null) and `handlers` (GET/POST route handlers), used by every API route in later tasks to identify `userId`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { authConfig } from "./auth.js";

describe("authConfig", () => {
  it("configures exactly one Google provider", () => {
    expect(authConfig.providers).toHaveLength(1);
  });

  it("copies the Google profile id onto session.user.id via signIn callback", async () => {
    const session = { user: { id: "", email: "a@b.com" } } as any;
    const result = await authConfig.callbacks!.session!({
      session,
      token: { sub: "google-user-123" },
    } as any);
    expect(result.user.id).toBe("google-user-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
pnpm add next-auth@beta
pnpm test src/auth.test.ts
```

Expected: FAIL with "Cannot find module './auth.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/auth.ts`:

```typescript
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { db, users } from "@clip-panda/db";
import { eq } from "drizzle-orm";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!profile?.sub || !user.email) return false;
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.googleId, profile.sub))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(users).values({ googleId: profile.sub, email: user.email });
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

Add to `apps/web/.env.local` (create the file, it is git-ignored):

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AUTH_SECRET=generate-with-npx-auth-secret
DATABASE_URL=your-postgres-connection-string
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/auth.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Manually verify sign-in**

```bash
pnpm dev
```

Visit `http://localhost:3000/api/auth/signin`, sign in with a Google
account, confirm a row appears in the `users` table with your `google_id`
and `email`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth.ts apps/web/src/app/api/auth
git commit -m "feat(web): add Google sign-in via Auth.js"
```

---

## Task 5: Object storage client (packages/storage)

**Files:**
- Create: `packages/storage/src/client.ts`
- Create: `packages/storage/src/index.ts`
- Test: `packages/storage/src/client.test.ts`

**Interfaces:**
- Consumes: env vars `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- Produces: `uploadObject(key: string, body: Buffer | Readable, contentType: string): Promise<string>` (returns the storage key), `getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>`, `getObjectBuffer(key: string): Promise<Buffer>`. Used by every import/render task from Task 6 onward.

- [ ] **Step 1: Write the failing test**

Create `packages/storage/src/client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const send = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

import { uploadObject } from "./client.js";

describe("uploadObject", () => {
  it("returns the key it was given", async () => {
    const key = await uploadObject("episodes/abc/source.mp4", Buffer.from("data"), "video/mp4");
    expect(key).toBe("episodes/abc/source.mp4");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\storage"
pnpm test
```

Expected: FAIL with "Cannot find module './client.js'"

- [ ] **Step 3: Write the implementation**

Create `packages/storage/src/client.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

function createClient() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

const client = createClient();
const bucket = process.env.S3_BUCKET!;

export async function uploadObject(
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as Readable) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

Create `packages/storage/src/index.ts`:

```typescript
export * from "./client.js";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): add S3-compatible upload/download client"
```

---

## Task 6: Episode import — file upload (apps/web)

**Files:**
- Create: `apps/web/src/app/api/episodes/route.ts`
- Test: `apps/web/src/app/api/episodes/route.test.ts`

**Interfaces:**
- Consumes: `auth()` from Task 4, `uploadObject` from Task 5, `db`/`episodes` from Task 2.
- Produces: `POST /api/episodes` (multipart form with a `file` field and `title` field) → creates an `episodes` row with `sourceType="upload"`, `status="importing"`, uploads the file to `episodes/<id>/source.<ext>`, then flips status to `"transcribing"` so the worker (Task 8) picks it up. Response: `{ episodeId: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/episodes/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@clip-panda/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue("episodes/ep-1/source.mp4"),
}));

const insertedRows: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          const withId = { id: "ep-1", ...row };
          insertedRows.push(withId);
          return [withId];
        },
      }),
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  },
  episodes: {},
}));

import { POST } from "./route.js";

beforeEach(() => insertedRows.length === 0);

describe("POST /api/episodes", () => {
  it("creates an episode from an uploaded file", async () => {
    const form = new FormData();
    form.append("title", "My Episode");
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "source.mp4", { type: "video/mp4" })
    );
    const request = new Request("http://localhost/api/episodes", {
      method: "POST",
      body: form,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.episodeId).toBe("ep-1");
  });

  it("rejects requests with no signed-in user", async () => {
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValueOnce(null);

    const form = new FormData();
    form.append("title", "x");
    form.append("file", new File([new Uint8Array([1])], "x.mp4", { type: "video/mp4" }));
    const request = new Request("http://localhost/api/episodes", {
      method: "POST",
      body: form,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
pnpm test src/app/api/episodes/route.test.ts
```

Expected: FAIL with "Cannot find module './route.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/episodes/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, episodes } from "@clip-panda/db";
import { uploadObject } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

function extensionFor(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  return "bin";
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const title = form.get("title");
  const file = form.get("file");

  if (typeof title !== "string" || !(file instanceof File)) {
    return Response.json({ error: "title and file are required" }, { status: 400 });
  }

  const isAudio = file.type.startsWith("audio/");
  const [row] = await db
    .insert(episodes)
    .values({
      userId: session.user.id,
      title,
      sourceType: isAudio ? "audio_only" : "upload",
      sourceUri: "",
      status: "importing",
    })
    .returning();

  const ext = extensionFor(file.type);
  const key = `episodes/${row.id}/source.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, buffer, file.type);

  await db
    .update(episodes)
    .set({ sourceUri: key, status: "transcribing" })
    .where(eq(episodes.id, row.id));

  return Response.json({ episodeId: row.id }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/app/api/episodes/route.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/episodes
git commit -m "feat(web): add file upload endpoint for episode import"
```

---

## Task 7: Episode import — YouTube/direct URL fetch (apps/web + apps/worker)

**Files:**
- Modify: `apps/web/src/app/api/episodes/route.ts` (add URL branch)
- Create: `apps/worker/src/jobs/fetchSource.ts`
- Test: `apps/worker/src/jobs/fetchSource.test.ts`

**Interfaces:**
- Consumes: `db`/`episodes` from Task 2, `uploadObject` from Task 5.
- Produces: `fetchSourceForEpisode(episodeId: string): Promise<void>` — downloads a YouTube or direct-URL episode's media, uploads it to storage, and flips `episodes.status` to `"transcribing"` (or `"failed"` with `failureReason` set).

- [ ] **Step 1: Add the URL branch to the episodes API**

Modify `apps/web/src/app/api/episodes/route.ts` — replace the body-parsing
section to accept either a file or a `sourceUrl` field:

```typescript
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const title = form.get("title");
  const file = form.get("file");
  const sourceUrl = form.get("sourceUrl");

  if (typeof title !== "string") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  if (typeof sourceUrl === "string" && sourceUrl.length > 0) {
    const sourceType = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")
      ? "youtube_url"
      : "direct_url";
    const [row] = await db
      .insert(episodes)
      .values({ userId: session.user.id, title, sourceType, sourceUri: sourceUrl, status: "importing" })
      .returning();
    return Response.json({ episodeId: row.id }, { status: 201 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "file or sourceUrl is required" }, { status: 400 });
  }

  const isAudio = file.type.startsWith("audio/");
  const [row] = await db
    .insert(episodes)
    .values({
      userId: session.user.id,
      title,
      sourceType: isAudio ? "audio_only" : "upload",
      sourceUri: "",
      status: "importing",
    })
    .returning();

  const ext = extensionFor(file.type);
  const key = `episodes/${row.id}/source.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, buffer, file.type);

  await db
    .update(episodes)
    .set({ sourceUri: key, status: "transcribing" })
    .where(eq(episodes.id, row.id));

  return Response.json({ episodeId: row.id }, { status: 201 });
}
```

(`extensionFor` stays as defined in Task 6.)

- [ ] **Step 2: Write the failing worker test**

Create `apps/worker/src/jobs/fetchSource.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const dbState = {
  episode: {
    id: "ep-1",
    sourceType: "youtube_url",
    sourceUri: "https://youtube.com/watch?v=abc123",
    status: "importing",
  },
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      episodes: {
        findFirst: vi.fn().mockImplementation(async () => dbState.episode),
      },
    },
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.episode, patch);
        },
      }),
    }),
  },
  episodes: {},
}));

vi.mock("@clip-panda/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue("episodes/ep-1/source.mp4"),
}));

vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => cb(null, "", ""),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake video bytes")),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { fetchSourceForEpisode } from "./fetchSource.js";

describe("fetchSourceForEpisode", () => {
  it("downloads the source and marks the episode transcribing", async () => {
    await fetchSourceForEpisode("ep-1");
    expect(dbState.episode.status).toBe("transcribing");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\worker"
pnpm test src/jobs/fetchSource.test.ts
```

Expected: FAIL with "Cannot find module './fetchSource.js'"

- [ ] **Step 4: Write the implementation**

Create `apps/worker/src/jobs/fetchSource.ts`:

```typescript
import { execFile as execFileCb } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, episodes } from "@clip-panda/db";
import { uploadObject } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

const execFile = promisify(execFileCb);

export async function fetchSourceForEpisode(episodeId: string): Promise<void> {
  const episode = await db.query.episodes.findFirst({
    where: eq(episodes.id, episodeId),
  });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);

  const outputPath = join(tmpdir(), `${episodeId}-source.mp4`);

  try {
    if (episode.sourceType === "youtube_url") {
      await execFile("yt-dlp", ["-f", "mp4", "-o", outputPath, episode.sourceUri]);
    } else if (episode.sourceType === "direct_url") {
      const response = await fetch(episode.sourceUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${episode.sourceUri}: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(outputPath, Buffer.from(arrayBuffer))
      );
    } else {
      throw new Error(`fetchSourceForEpisode called for non-URL sourceType ${episode.sourceType}`);
    }

    const buffer = await readFile(outputPath);
    const key = `episodes/${episodeId}/source.mp4`;
    await uploadObject(key, buffer, "video/mp4");

    await db
      .update(episodes)
      .set({ sourceUri: key, status: "transcribing" })
      .where(eq(episodes.id, episodeId));
  } catch (error) {
    await db
      .update(episodes)
      .set({ status: "failed", failureReason: (error as Error).message })
      .where(eq(episodes.id, episodeId));
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/jobs/fetchSource.test.ts
```

Expected: PASS

- [ ] **Step 6: Note the YouTube ToS caveat in the worker README**

Create `apps/worker/README.md`:

```markdown
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
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/episodes apps/worker/src/jobs/fetchSource.ts apps/worker/src/jobs/fetchSource.test.ts apps/worker/README.md
git commit -m "feat: add YouTube/direct-URL episode import"
```

---

## Task 8: Worker polling loop

**Files:**
- Create: `apps/worker/src/poll.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/src/poll.test.ts`

**Interfaces:**
- Consumes: `fetchSourceForEpisode` from Task 7 (transcription/frame/render handlers plugged in by later tasks the same way).
- Produces: `runPollLoop(handlers: PollHandlers, intervalMs?: number): { stop(): void }` where `PollHandlers = { fetchPendingUrlEpisodes(): Promise<string[]>; onEpisodeReadyToFetch(id: string): Promise<void>; }` (extended in later tasks). This is the only place that owns the `setInterval` — every job type registers a handler here instead of running its own loop.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/src/poll.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\worker"
pnpm test src/poll.test.ts
```

Expected: FAIL with "Cannot find module './poll.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/worker/src/poll.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/poll.test.ts
```

Expected: PASS

- [ ] **Step 5: Wire it into the worker entrypoint**

Replace `apps/worker/src/index.ts`:

```typescript
import { runPollLoop } from "./poll.js";
import { db, episodes } from "@clip-panda/db";
import { eq, inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";

async function tick() {
  const pending = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing"]),
  });

  for (const episode of pending) {
    if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
      await fetchSourceForEpisode(episode.id);
    }
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
```

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/poll.ts apps/worker/src/poll.test.ts apps/worker/src/index.ts
git commit -m "feat(worker): add generic poll loop and wire up source-fetch job"
```

---

## Task 9: Gemini client + Transcription & Diarization module (packages/gemini)

**Files:**
- Create: `packages/gemini/src/client.ts`
- Create: `packages/gemini/src/transcribe.ts`
- Create: `packages/gemini/src/index.ts`
- Test: `packages/gemini/src/transcribe.test.ts`

**Interfaces:**
- Consumes: env var `GEMINI_API_KEY`.
- Produces: `transcribeMedia(mediaBuffer: Buffer, mimeType: string): Promise<TranscriptSegment[]>` (matches the `TranscriptSegment` shape from `@clip-panda/db`'s schema exactly — `speakerLabel`, `startMs`, `endMs`, `text`, `words: {word, startMs, endMs}[]`). Used by Task 10's worker job handler.

- [ ] **Step 1: Write the failing test**

Create `packages/gemini/src/transcribe.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { transcribeMedia } from "./transcribe.js";

describe("transcribeMedia", () => {
  it("parses Gemini's JSON response into TranscriptSegments", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            {
              speakerLabel: "Speaker A",
              startMs: 0,
              endMs: 2000,
              text: "hello there",
              words: [
                { word: "hello", startMs: 0, endMs: 900 },
                { word: "there", startMs: 900, endMs: 2000 },
              ],
            },
          ]),
      },
    });

    const segments = await transcribeMedia(Buffer.from("fake"), "video/mp4");

    expect(segments).toHaveLength(1);
    expect(segments[0].speakerLabel).toBe("Speaker A");
    expect(segments[0].words).toHaveLength(2);
  });

  it("throws a clear error if Gemini returns non-JSON", async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => "not json" } });
    await expect(transcribeMedia(Buffer.from("fake"), "video/mp4")).rejects.toThrow(
      /failed to parse/i
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\gemini"
pnpm test src/transcribe.test.ts
```

Expected: FAIL with "Cannot find module './transcribe.js'"

- [ ] **Step 3: Write the Gemini client wrapper**

Create `packages/gemini/src/client.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | undefined;

export function getGeminiModel(modelName = "gemini-2.5-pro") {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenerativeAI(apiKey);
  }
  return client.getGenerativeModel({ model: modelName });
}
```

- [ ] **Step 4: Write the transcription module with its exact prompt**

Create `packages/gemini/src/transcribe.ts`:

```typescript
import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export const TRANSCRIBE_PROMPT = `You are transcribing a podcast recording for a clipping tool.

Listen to the attached media in full and return ONLY a JSON array (no markdown
fences, no commentary) of transcript segments, one per continuous utterance by
a single speaker. Each element must have exactly this shape:

{
  "speakerLabel": string,   // "Speaker A", "Speaker B", etc. Use a stable label
                            // per distinct voice for the whole file.
  "startMs": number,        // segment start time in milliseconds from file start
  "endMs": number,          // segment end time in milliseconds from file start
  "text": string,           // the full text spoken in this segment
  "words": [
    { "word": string, "startMs": number, "endMs": number }
    // one entry per word, in order, covering the full segment duration.
    // Word timestamps must be monotonically increasing and fall within
    // [startMs, endMs] of the parent segment.
  ]
}

Rules:
- Identify distinct speakers by voice; if you cannot tell speakers apart,
  label everything "Speaker A".
- Do not merge two speakers' words into one segment.
- Do not skip filler words ("um", "yeah", "so") — include them, they matter
  for caption timing.
- If the file is silent or unintelligible for a stretch, do not fabricate
  text for that stretch — simply omit it.
- Return strictly valid JSON. No trailing commas. No text before or after
  the array.`;

export async function transcribeMedia(
  mediaBuffer: Buffer,
  mimeType: string
): Promise<TranscriptSegment[]> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    { text: TRANSCRIBE_PROMPT },
    { inlineData: { data: mediaBuffer.toString("base64"), mimeType } },
  ]);

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as TranscriptSegment[];
  } catch {
    throw new Error(`failed to parse Gemini transcription response as JSON: ${raw.slice(0, 200)}`);
  }
}
```

Add `TranscriptSegment`/`TranscriptWord` to `packages/shared` (they were
defined in `packages/db/src/schema.ts` in Task 2 — move the two interfaces
there instead so both `db` and `gemini` can depend on `shared` without a
circular dependency):

Create `packages/shared/src/transcript.ts`:

```typescript
export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
}
```

Modify `packages/shared/src/index.ts`:

```typescript
export * from "./caption-style.js";
export * from "./transcript.js";
```

Modify `packages/db/src/schema.ts` — delete the local `TranscriptWord` and
`TranscriptSegment` interface declarations (the two `export interface`
blocks defined just above the `transcripts` table in Task 2) and add an
import at the top of the file instead:

```typescript
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
```

Everything else in the file (the enums, `users`, `episodes` tables, and the
`transcripts` table's
`segments: jsonb("segments").$type<TranscriptSegment[]>().notNull()` column)
stays exactly as written in Task 2 — only the import line changes and the
two local interfaces are deleted, since `TranscriptSegment` now comes from
`@clip-panda/shared`.

Add `"@clip-panda/shared": "workspace:*"` to `packages/db/package.json`
dependencies.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\gemini"
pnpm test src/transcribe.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/gemini packages/shared/src/transcript.ts packages/shared/src/index.ts packages/db/src/schema.ts packages/db/package.json
git commit -m "feat(gemini): add transcription+diarization module with exact prompt"
```

---

## Task 10: Transcription worker job (apps/worker)

**Files:**
- Create: `apps/worker/src/jobs/transcribeEpisode.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/src/jobs/transcribeEpisode.test.ts`

**Interfaces:**
- Consumes: `transcribeMedia` from Task 9, `getObjectBuffer` from Task 5, `db`/`episodes`/`transcripts` from Task 2.
- Produces: `transcribeEpisode(episodeId: string): Promise<void>` — reads the episode's stored media, calls Gemini, writes a `transcripts` row, flips `episodes.status` to `"ready"` (or `"failed"`).

- [ ] **Step 1: Write the failing test**

Create `apps/worker/src/jobs/transcribeEpisode.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const dbState = {
  episode: { id: "ep-1", sourceUri: "episodes/ep-1/source.mp4", status: "transcribing" },
  insertedTranscript: null as any,
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: { episodes: { findFirst: vi.fn().mockImplementation(async () => dbState.episode) } },
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          dbState.insertedTranscript = row;
          return [{ id: "t-1", ...row }];
        },
      }),
    }),
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.episode, patch);
        },
      }),
    }),
  },
  episodes: {},
  transcripts: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake video")),
}));

vi.mock("@clip-panda/gemini", () => ({
  transcribeMedia: vi.fn().mockResolvedValue([
    { speakerLabel: "Speaker A", startMs: 0, endMs: 1000, text: "hi", words: [] },
  ]),
}));

import { transcribeEpisode } from "./transcribeEpisode.js";

describe("transcribeEpisode", () => {
  it("stores the transcript and marks the episode ready", async () => {
    await transcribeEpisode("ep-1");
    expect(dbState.insertedTranscript.episodeId).toBe("ep-1");
    expect(dbState.episode.status).toBe("ready");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\worker"
pnpm test src/jobs/transcribeEpisode.test.ts
```

Expected: FAIL with "Cannot find module './transcribeEpisode.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/worker/src/jobs/transcribeEpisode.ts`:

```typescript
import { db, episodes, transcripts } from "@clip-panda/db";
import { getObjectBuffer } from "@clip-panda/storage";
import { transcribeMedia } from "@clip-panda/gemini";
import { eq } from "drizzle-orm";

function mimeTypeFor(sourceUri: string): string {
  if (sourceUri.endsWith(".mp3")) return "audio/mpeg";
  if (sourceUri.endsWith(".wav")) return "audio/wav";
  if (sourceUri.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function transcribeEpisode(episodeId: string): Promise<void> {
  const episode = await db.query.episodes.findFirst({ where: eq(episodes.id, episodeId) });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);

  try {
    const buffer = await getObjectBuffer(episode.sourceUri);
    const segments = await transcribeMedia(buffer, mimeTypeFor(episode.sourceUri));

    await db.insert(transcripts).values({ episodeId, segments });
    await db.update(episodes).set({ status: "ready" }).where(eq(episodes.id, episodeId));
  } catch (error) {
    await db
      .update(episodes)
      .set({ status: "failed", failureReason: (error as Error).message })
      .where(eq(episodes.id, episodeId));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/jobs/transcribeEpisode.test.ts
```

Expected: PASS

- [ ] **Step 5: Wire it into the poll loop**

Modify `apps/worker/src/index.ts` — add the transcribing branch to `tick`:

```typescript
import { runPollLoop } from "./poll.js";
import { db, episodes } from "@clip-panda/db";
import { inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";
import { transcribeEpisode } from "./jobs/transcribeEpisode.js";

async function tick() {
  const pending = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing", "transcribing"]),
  });

  for (const episode of pending) {
    if (episode.status === "importing") {
      if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
        await fetchSourceForEpisode(episode.id);
      }
    } else if (episode.status === "transcribing") {
      await transcribeEpisode(episode.id);
    }
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
```

Note: for an `upload`/`audio_only` episode, Task 6 already sets status
directly to `"transcribing"`, so it's picked up here on the next tick without
ever passing through `fetchSourceForEpisode`.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/jobs/transcribeEpisode.ts apps/worker/src/jobs/transcribeEpisode.test.ts apps/worker/src/index.ts
git commit -m "feat(worker): add transcription job and wire into poll loop"
```

---

## Task 11: Clip Candidate Suggestion module (packages/gemini) + API route

**Files:**
- Create: `packages/gemini/src/suggestClips.ts`
- Create: `apps/web/src/app/api/episodes/[episodeId]/clip-candidates/route.ts`
- Test: `packages/gemini/src/suggestClips.test.ts`

**Interfaces:**
- Consumes: `TranscriptSegment[]` (from an episode's `transcripts` row), `getGeminiModel` from Task 9.
- Produces: `suggestClipCandidates(segments: TranscriptSegment[]): Promise<ClipCandidate[]>` where `ClipCandidate = { startMs: number; endMs: number; reason: string }`. Exposed via `GET /api/episodes/:episodeId/clip-candidates` for the storyboard-mode transcript UI (Task 19).

- [ ] **Step 1: Write the failing test**

Create `packages/gemini/src/suggestClips.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { suggestClipCandidates } from "./suggestClips.js";

describe("suggestClipCandidates", () => {
  it("parses Gemini's candidate list", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { startMs: 12000, endMs: 45000, reason: "hot take about AI jobs" },
          ]),
      },
    });

    const candidates = await suggestClipCandidates([
      { speakerLabel: "Speaker A", startMs: 0, endMs: 60000, text: "...", words: [] },
    ]);

    expect(candidates).toEqual([
      { startMs: 12000, endMs: 45000, reason: "hot take about AI jobs" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\gemini"
pnpm test src/suggestClips.test.ts
```

Expected: FAIL with "Cannot find module './suggestClips.js'"

- [ ] **Step 3: Write the implementation with its exact prompt**

Create `packages/gemini/src/suggestClips.ts`:

```typescript
import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export interface ClipCandidate {
  startMs: number;
  endMs: number;
  reason: string;
}

export const SUGGEST_CLIPS_PROMPT = `You are helping a podcast creator pick a
single continuous clip (30-90 seconds) to turn into a still-image carousel
for social media.

Below is the full episode transcript as a JSON array of segments (each with
speakerLabel, startMs, endMs, text). Read it and propose 3-6 candidate clip
ranges that would work well as a standalone, self-contained moment — it
should make sense to someone with no other context, have a clear beginning
and end, and be emotionally or intellectually engaging (a strong opinion, a
surprising fact, a funny exchange, useful advice).

Return ONLY a JSON array (no markdown fences, no commentary) where each
element has exactly this shape:

{
  "startMs": number,  // must align with a segment boundary in the transcript
  "endMs": number,    // must be startMs + between 30000 and 90000
  "reason": string    // one short sentence explaining why this moment works
}

Rules:
- Ranges must not overlap.
- Order the array from strongest to weakest candidate.
- Do not invent timestamps outside the transcript's covered range.

Transcript:
`;

export async function suggestClipCandidates(
  segments: TranscriptSegment[]
): Promise<ClipCandidate[]> {
  const model = getGeminiModel();
  const result = await model.generateContent(
    SUGGEST_CLIPS_PROMPT + JSON.stringify(segments)
  );

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as ClipCandidate[];
  } catch {
    throw new Error(`failed to parse Gemini clip-candidate response as JSON: ${raw.slice(0, 200)}`);
  }
}
```

Modify `packages/gemini/src/index.ts`:

```typescript
export * from "./transcribe.js";
export * from "./suggestClips.js";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/suggestClips.test.ts
```

Expected: PASS

- [ ] **Step 5: Expose it via an API route**

Create `apps/web/src/app/api/episodes/[episodeId]/clip-candidates/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, transcripts } from "@clip-panda/db";
import { suggestClipCandidates } from "@clip-panda/gemini";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.episodeId, episodeId),
  });
  if (!transcript) {
    return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
  }

  const candidates = await suggestClipCandidates(transcript.segments);
  return Response.json({ candidates });
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/gemini/src/suggestClips.ts packages/gemini/src/suggestClips.test.ts packages/gemini/src/index.ts apps/web/src/app/api/episodes/[episodeId]/clip-candidates
git commit -m "feat(gemini): add clip-candidate suggestion module and API route"
```

---

## Task 12: Highlight Extraction module (packages/gemini) + API route

**Files:**
- Create: `packages/gemini/src/extractHighlights.ts`
- Create: `apps/web/src/app/api/episodes/[episodeId]/highlights/route.ts`
- Test: `packages/gemini/src/extractHighlights.test.ts`

**Interfaces:**
- Consumes: `TranscriptSegment[]`, `getGeminiModel` from Task 9.
- Produces: `extractHighlights(segments: TranscriptSegment[], count: number): Promise<Highlight[]>` where `Highlight = { timestampMs: number; captionText: string }`. Exposed via `GET /api/episodes/:episodeId/highlights?count=15` for highlights-mode carousel creation (Task 17).

- [ ] **Step 1: Write the failing test**

Create `packages/gemini/src/extractHighlights.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();
vi.mock("./client.js", () => ({
  getGeminiModel: () => ({ generateContent: mockGenerateContent }),
}));

import { extractHighlights } from "./extractHighlights.js";

describe("extractHighlights", () => {
  it("parses Gemini's highlight list", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { timestampMs: 251000, captionText: "the surprising stat about churn" },
          ]),
      },
    });

    const highlights = await extractHighlights(
      [{ speakerLabel: "Speaker A", startMs: 0, endMs: 300000, text: "...", words: [] }],
      15
    );

    expect(highlights).toEqual([
      { timestampMs: 251000, captionText: "the surprising stat about churn" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\gemini"
pnpm test src/extractHighlights.test.ts
```

Expected: FAIL with "Cannot find module './extractHighlights.js'"

- [ ] **Step 3: Write the implementation with its exact prompt**

Create `packages/gemini/src/extractHighlights.ts`:

```typescript
import type { TranscriptSegment } from "@clip-panda/shared";
import { getGeminiModel } from "./client.js";

export interface Highlight {
  timestampMs: number;
  captionText: string;
}

export function buildExtractHighlightsPrompt(count: number): string {
  return `You are helping a podcast creator build a "best moments" image
carousel spanning the whole episode.

Below is the full episode transcript as a JSON array of segments (each with
speakerLabel, startMs, endMs, text). Read it and pick exactly ${count}
distinct, standalone quote-worthy moments spread across the episode's full
runtime (do not cluster them all in one section unless the episode is very
short). Each moment should be a single strong sentence or short exchange that
makes sense on its own without surrounding context — a hot take, a surprising
stat, concise advice, or a memorable line.

Return ONLY a JSON array (no markdown fences, no commentary) where each
element has exactly this shape:

{
  "timestampMs": number,   // a timestamp within an existing segment's
                           // [startMs, endMs] range, at the moment the
                           // quoted line is spoken
  "captionText": string    // the exact quoted text to caption this slide with,
                           // trimmed to at most 140 characters
}

Rules:
- Exactly ${count} elements, ordered chronologically by timestampMs.
- No two timestamps within 5000ms of each other.
- captionText must be a verbatim (or lightly trimmed) quote from the
  transcript, not a paraphrase.

Transcript:
`;
}

export async function extractHighlights(
  segments: TranscriptSegment[],
  count: number
): Promise<Highlight[]> {
  const model = getGeminiModel();
  const result = await model.generateContent(
    buildExtractHighlightsPrompt(count) + JSON.stringify(segments)
  );

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as Highlight[];
  } catch {
    throw new Error(`failed to parse Gemini highlights response as JSON: ${raw.slice(0, 200)}`);
  }
}
```

Modify `packages/gemini/src/index.ts`:

```typescript
export * from "./transcribe.js";
export * from "./suggestClips.js";
export * from "./extractHighlights.js";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/extractHighlights.test.ts
```

Expected: PASS

- [ ] **Step 5: Expose it via an API route**

Create `apps/web/src/app/api/episodes/[episodeId]/highlights/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, transcripts } from "@clip-panda/db";
import { extractHighlights } from "@clip-panda/gemini";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const count = Number(new URL(request.url).searchParams.get("count") ?? "15");
  if (!Number.isInteger(count) || count < 10 || count > 20) {
    return Response.json({ error: "count must be an integer between 10 and 20" }, { status: 400 });
  }

  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.episodeId, episodeId),
  });
  if (!transcript) {
    return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
  }

  const highlights = await extractHighlights(transcript.segments, count);
  return Response.json({ highlights });
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/gemini/src/extractHighlights.ts packages/gemini/src/extractHighlights.test.ts packages/gemini/src/index.ts apps/web/src/app/api/episodes/[episodeId]/highlights
git commit -m "feat(gemini): add highlight extraction module and API route"
```

---

## Task 13: Frame sampling + shared timestamp/caption helpers (packages/shared + apps/worker)

**Files:**
- Create: `packages/shared/src/sampling.ts`
- Test: `packages/shared/src/sampling.test.ts`
- Create: `apps/worker/src/frames.ts`
- Test: `apps/worker/src/frames.test.ts`

**Interfaces:**
- Consumes: `TranscriptSegment` from `@clip-panda/shared` (Task 9), `ffmpeg-static` binary path.
- Produces: `sampleFrameTimestamps(startMs: number, endMs: number, count: number): number[]` and `findCaptionForTimestamp(segments: TranscriptSegment[], timestampMs: number): string` from `@clip-panda/shared` (used by both apps/web's Task 17 and apps/worker here — this is why they live in the shared package, not the worker); `extractFrame(videoPath: string, timestampMs: number, outputPath: string): Promise<void>` from `apps/worker` (used by Task 16's render job).

- [ ] **Step 1: Write the failing test for the shared helpers**

Create `packages/shared/src/sampling.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sampleFrameTimestamps, findCaptionForTimestamp } from "./sampling.js";

describe("sampleFrameTimestamps", () => {
  it("returns `count` evenly spaced timestamps starting at startMs", () => {
    expect(sampleFrameTimestamps(0, 10000, 5)).toEqual([0, 2000, 4000, 6000, 8000]);
  });
});

describe("findCaptionForTimestamp", () => {
  const segments = [
    { speakerLabel: "Speaker A", startMs: 0, endMs: 5000, text: "first segment", words: [] },
    { speakerLabel: "Speaker B", startMs: 5000, endMs: 10000, text: "second segment", words: [] },
  ];

  it("returns the text of the segment containing the timestamp", () => {
    expect(findCaptionForTimestamp(segments, 6000)).toBe("second segment");
  });

  it("falls back to the nearest segment when no segment contains the timestamp", () => {
    expect(findCaptionForTimestamp(segments, 10500)).toBe("second segment");
  });

  it("returns an empty string for an empty segment list", () => {
    expect(findCaptionForTimestamp([], 1000)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\shared"
pnpm test src/sampling.test.ts
```

Expected: FAIL with "Cannot find module './sampling.js'"

- [ ] **Step 3: Write the shared implementation**

Create `packages/shared/src/sampling.ts`:

```typescript
import type { TranscriptSegment } from "./transcript.js";

export function sampleFrameTimestamps(startMs: number, endMs: number, count: number): number[] {
  const step = (endMs - startMs) / count;
  return Array.from({ length: count }, (_, i) => Math.round(startMs + i * step));
}

export function findCaptionForTimestamp(
  segments: TranscriptSegment[],
  timestampMs: number
): string {
  if (segments.length === 0) return "";

  const containing = segments.find((s) => timestampMs >= s.startMs && timestampMs <= s.endMs);
  if (containing) return containing.text;

  const nearest = segments.reduce((closest, s) => {
    const distance = Math.min(Math.abs(s.startMs - timestampMs), Math.abs(s.endMs - timestampMs));
    const closestDistance = Math.min(
      Math.abs(closest.startMs - timestampMs),
      Math.abs(closest.endMs - timestampMs)
    );
    return distance < closestDistance ? s : closest;
  });

  return nearest.text;
}
```

Modify `packages/shared/src/index.ts`:

```typescript
export * from "./caption-style.js";
export * from "./transcript.js";
export * from "./sampling.js";
```

- [ ] **Step 4: Run the shared test to verify it passes**

```bash
pnpm test src/sampling.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit the shared helpers**

```bash
git add packages/shared/src/sampling.ts packages/shared/src/sampling.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add frame timestamp sampling and caption lookup helpers"
```

- [ ] **Step 6: Write the failing worker test for frame extraction**

Create `apps/worker/src/frames.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => cb(null, "", ""),
}));

import { extractFrame } from "./frames.js";

describe("extractFrame", () => {
  it("resolves without throwing when ffmpeg succeeds", async () => {
    await expect(
      extractFrame("/tmp/source.mp4", 2000, "/tmp/frame-2000.png")
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\worker"
pnpm test src/frames.test.ts
```

Expected: FAIL with "Cannot find module './frames.js'"

- [ ] **Step 8: Write the worker implementation**

Create `apps/worker/src/frames.ts`:

```typescript
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
```

- [ ] **Step 9: Run test to verify it passes**

```bash
pnpm test src/frames.test.ts
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/worker/src/frames.ts apps/worker/src/frames.test.ts
git commit -m "feat(worker): add ffmpeg frame extraction"
```

---

## Task 14: Caption style API (apps/web)

**Files:**
- Create: `apps/web/src/app/api/caption-styles/route.ts`
- Create: `apps/web/src/lib/seedPresetStyles.ts`
- Test: `apps/web/src/app/api/caption-styles/route.test.ts`

**Interfaces:**
- Consumes: `captionStyleSchema`, `PRESET_CAPTION_STYLES` from Task 3; `db`/`captionStyles` from Task 2.
- Produces: `GET /api/caption-styles` (returns presets + any custom styles), `POST /api/caption-styles` (validates with `captionStyleSchema`, inserts a custom style, `isPreset: false` forced server-side). Used by Task 19's style picker UI.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/caption-styles/route.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

const inserted: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    select: () => ({ from: () => Promise.resolve([{ id: "preset-1", name: "Bold Yellow", isPreset: true }]) }),
    insert: () => ({
      values: (row: any) => ({
        returning: async () => {
          const withId = { id: "custom-1", ...row };
          inserted.push(withId);
          return [withId];
        },
      }),
    }),
  },
  captionStyles: {},
}));

import { GET, POST } from "./route.js";

describe("GET /api/caption-styles", () => {
  it("returns existing styles", async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.styles).toEqual([{ id: "preset-1", name: "Bold Yellow", isPreset: true }]);
  });
});

describe("POST /api/caption-styles", () => {
  it("creates a custom style and forces isPreset false", async () => {
    const request = new Request("http://localhost/api/caption-styles", {
      method: "POST",
      body: JSON.stringify({
        name: "My Style",
        isPreset: true,
        font: "Inter",
        textColor: "#FFFFFF",
        highlightColor: "#FFD700",
        size: 48,
        position: "bottom",
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.style.isPreset).toBe(false);
  });

  it("rejects an invalid body", async () => {
    const request = new Request("http://localhost/api/caption-styles", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
pnpm test src/app/api/caption-styles/route.test.ts
```

Expected: FAIL with "Cannot find module './route.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/caption-styles/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, captionStyles } from "@clip-panda/db";
import { captionStyleSchema } from "@clip-panda/shared";

export async function GET(): Promise<Response> {
  const styles = await db.select().from(captionStyles);
  return Response.json({ styles });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = captionStyleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [style] = await db
    .insert(captionStyles)
    .values({ ...parsed.data, isPreset: false })
    .returning();

  return Response.json({ style }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/app/api/caption-styles/route.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Write the one-time preset seed script**

Create `apps/web/src/lib/seedPresetStyles.ts`:

```typescript
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
```

Run it once against your dev database:

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
npx tsx src/lib/seedPresetStyles.ts
```

Expected: "Seeded 4 preset caption styles."

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/caption-styles apps/web/src/lib/seedPresetStyles.ts
git commit -m "feat(web): add caption style API and preset seed script"
```

---

## Task 15: SVG overlay renderer (packages/render)

**Files:**
- Create: `packages/render/src/overlay.ts`
- Create: `packages/render/src/index.ts`
- Test: `packages/render/src/overlay.test.ts`

**Interfaces:**
- Consumes: a `CaptionStyleInput` (from `@clip-panda/shared`), caption text, canvas dimensions.
- Produces: `renderOverlayPng(options: { width: number; height: number; captionText: string; style: CaptionStyleInput; watermarkText: string }): Buffer` — a transparent PNG containing the styled caption text plus the fixed bottom-right watermark, ready to be composited onto a background image by Task 16.

- [ ] **Step 1: Write the failing test**

Create `packages/render/src/overlay.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderOverlayPng } from "./overlay.js";
import { PRESET_CAPTION_STYLES } from "@clip-panda/shared";

describe("renderOverlayPng", () => {
  it("produces a non-empty PNG buffer", () => {
    const png = renderOverlayPng({
      width: 1920,
      height: 1080,
      captionText: "This is a test caption",
      style: PRESET_CAPTION_STYLES[0],
      watermarkText: "Clip Panda",
    });

    expect(png.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\packages\render"
pnpm test src/overlay.test.ts
```

Expected: FAIL with "Cannot find module './overlay.js'"

- [ ] **Step 3: Write the implementation**

Create `packages/render/src/overlay.ts`:

```typescript
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
```

Create `packages/render/src/index.ts`:

```typescript
export * from "./overlay.js";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/overlay.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/render
git commit -m "feat(render): add SVG caption+watermark overlay renderer"
```

---

## Task 16: Slide render job — video frame path + audio-only quote card path (apps/worker)

**Files:**
- Create: `apps/worker/src/jobs/renderSlide.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/src/jobs/renderSlide.test.ts`

**Interfaces:**
- Consumes: `extractFrame` from Task 13, `renderOverlayPng` from Task 15, `uploadObject`/`getObjectBuffer` from Task 5, `db`/`slides`/`carousels`/`episodes`/`captionStyles` from Task 2.
- Produces: `renderSlide(slideId: string): Promise<void>` — for a video-source carousel, extracts the frame at `slide.timestampMs`, composites the caption+watermark overlay, uploads the result, sets `slide.status = "rendered"` and `slide.imageUrl`. For an audio-only episode, generates a solid-background 16:9 canvas instead of extracting a frame, then composites the same overlay. Also produces `renderQuoteCardBackground(): Buffer` used only in the audio-only path.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/src/jobs/renderSlide.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const dbState = {
  slide: { id: "slide-1", carouselId: "carousel-1", timestampMs: 5000, captionText: "hello", status: "pending" },
  carousel: { id: "carousel-1", episodeId: "ep-1", captionStyleId: "style-1" },
  episode: { id: "ep-1", sourceType: "upload", sourceUri: "episodes/ep-1/source.mp4" },
  style: { id: "style-1", name: "Bold Yellow", isPreset: true, font: "Inter-Bold", textColor: "#FFF", highlightColor: "#FFD700", size: 56, position: "bottom" },
};

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      slides: { findFirst: vi.fn().mockImplementation(async () => dbState.slide) },
      carousels: { findFirst: vi.fn().mockImplementation(async () => dbState.carousel) },
      episodes: { findFirst: vi.fn().mockImplementation(async () => dbState.episode) },
      captionStyles: { findFirst: vi.fn().mockImplementation(async () => dbState.style) },
    },
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          Object.assign(dbState.slide, patch);
        },
      }),
    }),
  },
  slides: {},
  carousels: {},
  episodes: {},
  captionStyles: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake source video")),
  uploadObject: vi.fn().mockResolvedValue("carousels/carousel-1/slide-1.png"),
}));

vi.mock("../frames.js", () => ({
  extractFrame: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake frame png")),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sharp", () => {
  const instance = {
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("composited png")),
    resize: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn().mockReturnValue(instance) };
});

vi.mock("@clip-panda/render", () => ({
  renderOverlayPng: vi.fn().mockReturnValue(Buffer.from("overlay png")),
}));

import { renderSlide } from "./renderSlide.js";

describe("renderSlide", () => {
  it("renders a video-frame slide and marks it rendered", async () => {
    await renderSlide("slide-1");
    expect(dbState.slide.status).toBe("rendered");
    expect((dbState.slide as any).imageUrl).toBe("carousels/carousel-1/slide-1.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\worker"
pnpm add sharp
pnpm test src/jobs/renderSlide.test.ts
```

Expected: FAIL with "Cannot find module './renderSlide.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/worker/src/jobs/renderSlide.ts`:

```typescript
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { db, slides, carousels, episodes, captionStyles } from "@clip-panda/db";
import { getObjectBuffer, uploadObject } from "@clip-panda/storage";
import { renderOverlayPng } from "@clip-panda/render";
import { extractFrame } from "../frames.js";
import { eq } from "drizzle-orm";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

function renderQuoteCardBackground(): Buffer {
  const svg = `<svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#111111" />
  </svg>`;
  return Buffer.from(svg);
}

export async function renderSlide(slideId: string): Promise<void> {
  const slide = await db.query.slides.findFirst({ where: eq(slides.id, slideId) });
  if (!slide) throw new Error(`Slide ${slideId} not found`);

  try {
    const carousel = await db.query.carousels.findFirst({
      where: eq(carousels.id, slide.carouselId),
    });
    if (!carousel) throw new Error(`Carousel ${slide.carouselId} not found`);

    const episode = await db.query.episodes.findFirst({
      where: eq(episodes.id, carousel.episodeId),
    });
    if (!episode) throw new Error(`Episode ${carousel.episodeId} not found`);

    const style = await db.query.captionStyles.findFirst({
      where: eq(captionStyles.id, carousel.captionStyleId),
    });
    if (!style) throw new Error(`Caption style ${carousel.captionStyleId} not found`);

    let background: Buffer;

    if (episode.sourceType === "audio_only") {
      background = renderQuoteCardBackground();
      background = await sharp(background).resize(SLIDE_WIDTH, SLIDE_HEIGHT).png().toBuffer();
    } else {
      const sourceBuffer = await getObjectBuffer(episode.sourceUri);
      const sourcePath = join(tmpdir(), `${episode.id}-source.mp4`);
      await writeFile(sourcePath, sourceBuffer);

      const framePath = join(tmpdir(), `${slide.id}-frame.png`);
      await extractFrame(sourcePath, slide.timestampMs ?? 0, framePath);
      background = await sharp(await readFile(framePath))
        .resize(SLIDE_WIDTH, SLIDE_HEIGHT)
        .png()
        .toBuffer();

      await unlink(sourcePath).catch(() => {});
      await unlink(framePath).catch(() => {});
    }

    const overlay = renderOverlayPng({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      captionText: slide.captionText,
      style,
      watermarkText: "Clip Panda",
    });

    const composited = await sharp(background)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const key = `carousels/${carousel.id}/slide-${slide.orderIndex}.png`;
    await uploadObject(key, composited, "image/png");

    await db
      .update(slides)
      .set({ status: "rendered", imageUrl: key })
      .where(eq(slides.id, slideId));
  } catch (error) {
    await db
      .update(slides)
      .set({ status: "failed", failureReason: (error as Error).message })
      .where(eq(slides.id, slideId));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/jobs/renderSlide.test.ts
```

Expected: PASS

- [ ] **Step 5: Wire it into the poll loop**

Modify `apps/worker/src/index.ts` — add a slide-rendering pass to `tick`:

```typescript
import { runPollLoop } from "./poll.js";
import { db, episodes, slides } from "@clip-panda/db";
import { inArray } from "drizzle-orm";
import { fetchSourceForEpisode } from "./jobs/fetchSource.js";
import { transcribeEpisode } from "./jobs/transcribeEpisode.js";
import { renderSlide } from "./jobs/renderSlide.js";

async function tick() {
  const pendingEpisodes = await db.query.episodes.findMany({
    where: inArray(episodes.status, ["importing", "transcribing"]),
  });

  for (const episode of pendingEpisodes) {
    if (episode.status === "importing") {
      if (episode.sourceType === "youtube_url" || episode.sourceType === "direct_url") {
        await fetchSourceForEpisode(episode.id);
      }
    } else if (episode.status === "transcribing") {
      await transcribeEpisode(episode.id);
    }
  }

  const pendingSlides = await db.query.slides.findMany({
    where: inArray(slides.status, ["pending"]),
  });

  for (const slide of pendingSlides) {
    await renderSlide(slide.id);
  }
}

console.log("worker starting, polling every 5s...");
runPollLoop(tick, 5000);
```

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/jobs/renderSlide.ts apps/worker/src/jobs/renderSlide.test.ts apps/worker/src/index.ts apps/worker/package.json
git commit -m "feat(worker): add slide rendering job for video and audio-only sources"
```

---

## Task 17: Carousel creation orchestration API (apps/web)

**Files:**
- Create: `apps/web/src/app/api/episodes/[episodeId]/carousels/route.ts`
- Test: `apps/web/src/app/api/episodes/[episodeId]/carousels/route.test.ts`

**Interfaces:**
- Consumes: `extractHighlights` output shape (client already fetched highlights before calling this in highlights mode), `sampleFrameTimestamps`/`findCaptionForTimestamp` from Task 13, `db`/`carousels`/`slides`/`transcripts` from Task 2.
- Produces: `POST /api/episodes/:episodeId/carousels` accepting either
  `{ mode: "storyboard", clipStartMs, clipEndMs, slideCount, captionStyleId }`
  (server samples timestamps and looks up caption text from the episode's
  transcript itself — the client never has to compute per-slide captions)
  or `{ mode: "highlights", highlights: {timestampMs, captionText}[], captionStyleId }`.
  Creates a `carousels` row plus one `pending` `slides` row per slide (with
  `timestampMs` and `captionText` pre-filled so the worker's `renderSlide`
  from Task 16 has everything it needs). Response: `{ carouselId: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/episodes/[episodeId]/carousels/route.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

const insertedSlides: any[] = [];
vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      transcripts: {
        findFirst: vi.fn().mockResolvedValue({
          segments: [
            { speakerLabel: "Speaker A", startMs: 0, endMs: 30000, text: "the first half", words: [] },
            { speakerLabel: "Speaker A", startMs: 30000, endMs: 60000, text: "the second half", words: [] },
          ],
        }),
      },
    },
    insert: (table: any) => ({
      values: (rowOrRows: any) => ({
        returning: async () => {
          if (Array.isArray(rowOrRows)) {
            insertedSlides.push(...rowOrRows);
            return rowOrRows.map((r, i) => ({ id: `slide-${i}`, ...r }));
          }
          return [{ id: "carousel-1", ...rowOrRows }];
        },
      }),
    }),
  },
  carousels: {},
  slides: {},
  transcripts: {},
}));

import { POST } from "./route.js";

describe("POST /api/episodes/:episodeId/carousels", () => {
  it("creates a highlights-mode carousel with one slide per highlight", async () => {
    const request = new Request("http://localhost/api/episodes/ep-1/carousels", {
      method: "POST",
      body: JSON.stringify({
        mode: "highlights",
        captionStyleId: "style-1",
        highlights: [
          { timestampMs: 1000, captionText: "first" },
          { timestampMs: 2000, captionText: "second" },
        ],
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ episodeId: "ep-1" }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.carouselId).toBe("carousel-1");
    expect(insertedSlides).toHaveLength(2);
    expect(insertedSlides[0].orderIndex).toBe(0);
    expect(insertedSlides[1].captionText).toBe("second");
  });

  it("creates a storyboard-mode carousel, sampling timestamps and looking up captions from the transcript", async () => {
    insertedSlides.length = 0;
    const request = new Request("http://localhost/api/episodes/ep-1/carousels", {
      method: "POST",
      body: JSON.stringify({
        mode: "storyboard",
        captionStyleId: "style-1",
        clipStartMs: 0,
        clipEndMs: 60000,
        slideCount: 2,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ episodeId: "ep-1" }) });
    expect(response.status).toBe(201);
    expect(insertedSlides).toHaveLength(2);
    expect(insertedSlides[0].captionText).toBe("the first half");
    expect(insertedSlides[1].captionText).toBe("the second half");
  });

  it("rejects storyboard mode missing clip range", async () => {
    const request = new Request("http://localhost/api/episodes/ep-1/carousels", {
      method: "POST",
      body: JSON.stringify({ mode: "storyboard", captionStyleId: "style-1" }),
    });
    const response = await POST(request, { params: Promise.resolve({ episodeId: "ep-1" }) });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
pnpm test src/app/api/episodes/[episodeId]/carousels/route.test.ts
```

Expected: FAIL with "Cannot find module './route.js'"

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/episodes/[episodeId]/carousels/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, carousels, slides, transcripts } from "@clip-panda/db";
import { sampleFrameTimestamps, findCaptionForTimestamp } from "@clip-panda/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

const highlightsBodySchema = z.object({
  mode: z.literal("highlights"),
  captionStyleId: z.string().uuid(),
  highlights: z
    .array(z.object({ timestampMs: z.number().int().min(0), captionText: z.string().min(1) }))
    .min(10)
    .max(20),
});

const storyboardBodySchema = z.object({
  mode: z.literal("storyboard"),
  captionStyleId: z.string().uuid(),
  clipStartMs: z.number().int().min(0),
  clipEndMs: z.number().int().min(0),
  slideCount: z.number().int().min(10).max(20),
});

const bodySchema = z.discriminatedUnion("mode", [highlightsBodySchema, storyboardBodySchema]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { episodeId } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  let slideInputs: { timestampMs: number; captionText: string }[];

  if (body.mode === "highlights") {
    slideInputs = body.highlights;
  } else {
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.episodeId, episodeId),
    });
    if (!transcript) {
      return Response.json({ error: "Transcript not ready yet" }, { status: 404 });
    }
    const timestamps = sampleFrameTimestamps(body.clipStartMs, body.clipEndMs, body.slideCount);
    slideInputs = timestamps.map((timestampMs) => ({
      timestampMs,
      captionText: findCaptionForTimestamp(transcript.segments, timestampMs),
    }));
  }

  const [carousel] = await db
    .insert(carousels)
    .values({
      episodeId,
      mode: body.mode,
      clipStartMs: body.mode === "storyboard" ? body.clipStartMs : null,
      clipEndMs: body.mode === "storyboard" ? body.clipEndMs : null,
      captionStyleId: body.captionStyleId,
      status: "pending",
    })
    .returning();

  await db.insert(slides).values(
    slideInputs.map((s, index) => ({
      carouselId: carousel.id,
      orderIndex: index,
      timestampMs: s.timestampMs,
      captionText: s.captionText,
      status: "pending" as const,
    }))
  );

  return Response.json({ carouselId: carousel.id }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/app/api/episodes/[episodeId]/carousels/route.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/episodes/[episodeId]/carousels
git commit -m "feat(web): add carousel creation API for storyboard and highlights modes"
```

---

## Task 18: Gallery, per-slide regenerate, and ZIP export (apps/web)

**Files:**
- Create: `apps/web/src/app/api/carousels/[carouselId]/route.ts`
- Create: `apps/web/src/app/api/slides/[slideId]/regenerate/route.ts`
- Create: `apps/web/src/app/api/carousels/[carouselId]/export/route.ts`
- Test: `apps/web/src/app/api/carousels/[carouselId]/export/route.test.ts`

**Interfaces:**
- Consumes: `getSignedDownloadUrl`/`getObjectBuffer` from Task 5, `db`/`slides`/`carousels` from Task 2.
- Produces: `GET /api/carousels/:carouselId` (returns carousel + slides with signed image URLs, for the gallery UI), `POST /api/slides/:slideId/regenerate` (resets a slide to `status: "pending"` so the worker's poll loop re-renders it), `GET /api/carousels/:carouselId/export` (streams a ZIP of all rendered slide images).

- [ ] **Step 1: Write the gallery and regenerate endpoints (no new logic to unit test beyond what Tasks 2/5/16 already cover — these are thin read/reset endpoints)**

Create `apps/web/src/app/api/carousels/[carouselId]/route.ts`:

```typescript
import { db, slides } from "@clip-panda/db";
import { getSignedDownloadUrl } from "@clip-panda/storage";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
): Promise<Response> {
  const { carouselId } = await params;
  const carouselSlides = await db.query.slides.findMany({
    where: eq(slides.carouselId, carouselId),
    orderBy: (s, { asc }) => [asc(s.orderIndex)],
  });

  const withUrls = await Promise.all(
    carouselSlides.map(async (slide) => ({
      ...slide,
      downloadUrl: slide.imageUrl ? await getSignedDownloadUrl(slide.imageUrl) : null,
    }))
  );

  return Response.json({ slides: withUrls });
}
```

Create `apps/web/src/app/api/slides/[slideId]/regenerate/route.ts`:

```typescript
import { auth } from "@/auth";
import { db, slides } from "@clip-panda/db";
import { eq } from "drizzle-orm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slideId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slideId } = await params;
  await db
    .update(slides)
    .set({ status: "pending", failureReason: null, imageUrl: null })
    .where(eq(slides.id, slideId));

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Write the failing export test**

Create `apps/web/src/app/api/carousels/[carouselId]/export/route.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@clip-panda/db", () => ({
  db: {
    query: {
      slides: {
        findMany: vi.fn().mockResolvedValue([
          { id: "s1", orderIndex: 0, imageUrl: "carousels/c1/slide-0.png", status: "rendered" },
          { id: "s2", orderIndex: 1, imageUrl: "carousels/c1/slide-1.png", status: "rendered" },
        ]),
      },
    },
  },
  slides: {},
}));

vi.mock("@clip-panda/storage", () => ({
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("fake png bytes")),
}));

import { GET } from "./route.js";

describe("GET /api/carousels/:carouselId/export", () => {
  it("returns a zip response with the correct content type", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ carouselId: "c1" }),
    });

    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda\apps\web"
pnpm add archiver
pnpm add -D @types/archiver
pnpm test src/app/api/carousels/[carouselId]/export/route.test.ts
```

Expected: FAIL with "Cannot find module './route.js'"

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/app/api/carousels/[carouselId]/export/route.ts`:

```typescript
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { db, slides } from "@clip-panda/db";
import { getObjectBuffer } from "@clip-panda/storage";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
): Promise<Response> {
  const { carouselId } = await params;
  const carouselSlides = await db.query.slides.findMany({
    where: and(eq(slides.carouselId, carouselId), eq(slides.status, "rendered")),
    orderBy: (s, { asc }) => [asc(s.orderIndex)],
  });

  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(passthrough);

  for (const slide of carouselSlides) {
    if (!slide.imageUrl) continue;
    const buffer = await getObjectBuffer(slide.imageUrl);
    archive.append(buffer, { name: `slide-${String(slide.orderIndex + 1).padStart(2, "0")}.png` });
  }
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(Buffer.from(chunk));
  }

  return new Response(Buffer.concat(chunks), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="carousel-${carouselId}.zip"`,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/app/api/carousels/[carouselId]/export/route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/carousels apps/web/src/app/api/slides apps/web/package.json
git commit -m "feat(web): add gallery read, per-slide regenerate, and ZIP export endpoints"
```

---

## Task 19: Frontend flow — import, mode selection, clip fine-tune, style picker, gallery (apps/web)

**Files:**
- Create: `apps/web/src/app/episodes/new/page.tsx`
- Create: `apps/web/src/app/episodes/[episodeId]/page.tsx`
- Create: `apps/web/src/app/carousels/[carouselId]/page.tsx`
- Create: `apps/web/src/components/CaptionStylePicker.tsx`

**Interfaces:**
- Consumes: every API route from Tasks 4, 6, 7, 11, 12, 14, 17, 18.
- Produces: the three user-facing pages that complete the end-to-end flow: import → pick mode/clip/highlights + caption style → gallery with regenerate/download.

- [ ] **Step 1: Import page**

Create `apps/web/src/app/episodes/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEpisodePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.append("title", title);
    if (sourceUrl) form.append("sourceUrl", sourceUrl);
    if (file) form.append("file", file);

    const response = await fetch("/api/episodes", { method: "POST", body: form });
    setSubmitting(false);

    if (!response.ok) {
      const json = await response.json();
      setError(json.error ?? "Something went wrong");
      return;
    }

    const json = await response.json();
    router.push(`/episodes/${json.episodeId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Import an episode</h1>
      <input
        className="w-full border rounded p-2"
        placeholder="Episode title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="w-full border rounded p-2"
        placeholder="YouTube or direct video URL (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />
      <input
        type="file"
        accept="video/*,audio/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting || (!file && !sourceUrl)}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Importing..." : "Import"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Caption style picker component**

Create `apps/web/src/components/CaptionStylePicker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface CaptionStyle {
  id: string;
  name: string;
  isPreset: boolean;
}

export function CaptionStylePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (styleId: string) => void;
}) {
  const [styles, setStyles] = useState<CaptionStyle[]>([]);

  useEffect(() => {
    fetch("/api/caption-styles")
      .then((r) => r.json())
      .then((json) => setStyles(json.styles));
  }, []);

  return (
    <div className="flex gap-2 flex-wrap">
      {styles.map((style) => (
        <button
          key={style.id}
          type="button"
          onClick={() => onChange(style.id)}
          className={`border rounded px-3 py-1 text-sm ${
            value === style.id ? "bg-black text-white" : "bg-white"
          }`}
        >
          {style.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Episode page — mode selection, clip fine-tune (storyboard), highlights review**

Create `apps/web/src/app/episodes/[episodeId]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CaptionStylePicker } from "@/components/CaptionStylePicker";

interface ClipCandidate {
  startMs: number;
  endMs: number;
  reason: string;
}

interface Highlight {
  timestampMs: number;
  captionText: string;
}

export default function EpisodePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"storyboard" | "highlights">("highlights");
  const [captionStyleId, setCaptionStyleId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ClipCandidate | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadStoryboardCandidates() {
    const response = await fetch(`/api/episodes/${episodeId}/clip-candidates`);
    const json = await response.json();
    setCandidates(json.candidates);
  }

  async function loadHighlights() {
    const response = await fetch(`/api/episodes/${episodeId}/highlights?count=15`);
    const json = await response.json();
    setHighlights(json.highlights);
  }

  async function createCarousel() {
    if (!captionStyleId) return;
    setSubmitting(true);

    const body =
      mode === "highlights"
        ? { mode: "highlights", captionStyleId, highlights }
        : {
            mode: "storyboard",
            captionStyleId,
            clipStartMs: selectedCandidate!.startMs,
            clipEndMs: selectedCandidate!.endMs,
            slideCount: 15,
          };

    const response = await fetch(`/api/episodes/${episodeId}/carousels`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (response.ok) {
      const json = await response.json();
      router.push(`/carousels/${json.carouselId}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Build a carousel</h1>

      <div className="flex gap-2">
        <button
          className={mode === "highlights" ? "font-bold underline" : ""}
          onClick={() => {
            setMode("highlights");
            loadHighlights();
          }}
        >
          Highlights mode
        </button>
        <button
          className={mode === "storyboard" ? "font-bold underline" : ""}
          onClick={() => {
            setMode("storyboard");
            loadStoryboardCandidates();
          }}
        >
          Storyboard mode
        </button>
      </div>

      {mode === "highlights" && (
        <p className="text-sm text-gray-600">{highlights.length} highlight moments found.</p>
      )}

      {mode === "storyboard" && (
        <ul className="space-y-2">
          {candidates.map((candidate) => (
            <li key={candidate.startMs}>
              <button
                className={`border rounded p-2 w-full text-left ${
                  selectedCandidate?.startMs === candidate.startMs ? "bg-gray-100" : ""
                }`}
                onClick={() => setSelectedCandidate(candidate)}
              >
                {(candidate.startMs / 1000).toFixed(0)}s–{(candidate.endMs / 1000).toFixed(0)}s:{" "}
                {candidate.reason}
              </button>
            </li>
          ))}
        </ul>
      )}

      <CaptionStylePicker value={captionStyleId} onChange={setCaptionStyleId} />

      <button
        onClick={createCarousel}
        disabled={
          submitting ||
          !captionStyleId ||
          (mode === "highlights" && highlights.length === 0) ||
          (mode === "storyboard" && !selectedCandidate)
        }
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Generate carousel"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Gallery page**

Create `apps/web/src/app/carousels/[carouselId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Slide {
  id: string;
  orderIndex: number;
  status: "pending" | "rendered" | "failed";
  downloadUrl: string | null;
}

export default function CarouselGalleryPage() {
  const { carouselId } = useParams<{ carouselId: string }>();
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const response = await fetch(`/api/carousels/${carouselId}`);
      const json = await response.json();
      if (!cancelled) setSlides(json.slides);
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [carouselId]);

  async function regenerate(slideId: string) {
    await fetch(`/api/slides/${slideId}/regenerate`, { method: "POST" });
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Your carousel</h1>
        <a
          href={`/api/carousels/${carouselId}/export`}
          className="bg-black text-white rounded px-4 py-2"
        >
          Download All
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {slides.map((slide) => (
          <div key={slide.id} className="border rounded overflow-hidden">
            {slide.status === "rendered" && slide.downloadUrl ? (
              <img src={slide.downloadUrl} alt={`Slide ${slide.orderIndex + 1}`} />
            ) : (
              <div className="aspect-video flex items-center justify-center text-sm text-gray-500">
                {slide.status}
              </div>
            )}
            <button className="w-full text-sm py-1" onClick={() => regenerate(slide.id)}>
              Regenerate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual end-to-end verification**

```bash
cd "C:\Users\Christopher\Documents\Clip Panda"
pnpm dev:web
pnpm dev:worker
```

In the browser: sign in, go to `/episodes/new`, upload a short (~1 min) test
video with two people talking, wait for it to reach `/episodes/<id>`, pick
Highlights mode, pick a caption style, generate the carousel, and confirm
the gallery fills in with rendered slides (watermark visible in the
bottom-right of each) and "Download All" produces a working ZIP.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/episodes apps/web/src/app/carousels apps/web/src/components
git commit -m "feat(web): add import, mode-selection, and gallery frontend pages"
```

---

## Self-review notes

**Spec coverage** — every module workflow from the design spec maps to a task:
Import (Tasks 6-7), Transcription & Diarization (Task 9-10), Clip Candidate
Suggestion (Task 11), Highlight Extraction (Task 12), Frame Sampling (Task 13),
Slide Rendering (Tasks 15-16), Gallery & Export (Task 18), Auth (Task 4),
Caption styling (Tasks 3, 14, 19), Watermark (Task 15). The two non-goals
(no video export, no billing) are respected — no task produces a video file
or touches payments.

**Type consistency fix applied during review** — `sampleFrameTimestamps` was
initially drafted twice (once in the worker, once implicitly needed by the
web API) and a storyboard-mode caption gap (blank `captionText`) was caught;
both were resolved by moving `sampleFrameTimestamps` and a new
`findCaptionForTimestamp` helper into `packages/shared` (Task 13), consumed
identically by both `apps/worker` (frame extraction) and `apps/web` (Task 17's
carousel creation route). `TranscriptSegment`/`TranscriptWord` also live in
`packages/shared` (moved there in Task 9) so `packages/db` and
`packages/gemini` both depend on `packages/shared` without a cycle.

**Known simplification carried from the spec, not hidden in code:** storyboard
mode's per-slide caption is whichever transcript segment's time range contains
the sampled timestamp (or the nearest segment if none contains it exactly) —
this can occasionally span more text than the instant shown in the frame, but
matches the spec's "what is said on the podcast" framing without requiring a
sub-segment word-level caption windowing feature, which was not requested.

---

## Execution options

**Plan complete and saved to `docs/superpowers/plans/2026-07-11-clip-panda-v1.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
