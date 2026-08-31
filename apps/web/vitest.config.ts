import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests mock @clip-panda/db everywhere except auth.test.ts, which imports
// the real authConfig (and therefore the real db client at module load).
// postgres() connects lazily, so a dummy DATABASE_URL lets import succeed
// without any real connection being attempted.
process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";

export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping, which Vite
      // does not pick up automatically. Without this, any unmocked "@/..."
      // import (e.g. src/lib/ownership.ts) fails to resolve in tests.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
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
