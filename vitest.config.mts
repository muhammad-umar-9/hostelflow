import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Two projects, deliberately separated so a suite that did not run can never be mistaken
 * for a suite that passed:
 *
 *   unit        pure functions. No database, no network. Runs anywhere, always.
 *   integration talks to a real PostgreSQL. Skips loudly without DATABASE_URL, because
 *               the development machine has no database — see CLAUDE.md.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: { "@": path.resolve(import.meta.dirname) },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname),
            // The integration suite runs in Node and imports lib/server/* deliberately.
            // The real `server-only` package throws on import outside a React Server
            // Component, which would stop these tests importing the very modules they
            // exist to exercise. The unit project keeps the real package.
            "server-only": path.resolve(
              import.meta.dirname,
              "tests/stubs/server-only.ts",
            ),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // A database round trip is slower than a pure function, and the suite creates
          // and tears down real rows.
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Integration tests share one database; running files in parallel would make
          // them fight over the same hostel rows.
          fileParallelism: false,
        },
      },
    ],
  },
});
