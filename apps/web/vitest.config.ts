import { defineConfig } from "vitest/config";

// Unit tests mock @clip-panda/db everywhere except auth.test.ts, which imports
// the real authConfig (and therefore the real db client at module load).
// postgres() connects lazily, so a dummy DATABASE_URL lets import succeed
// without any real connection being attempted.
process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";

export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    server: {
      deps: {
        inline: [/next-auth/],
      },
    },
  },
});
