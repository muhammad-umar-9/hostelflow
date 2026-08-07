import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE, e2eDatabaseUrl } from "./tests/e2e/config";

/**
 * Smoke tests run against a production build, not the dev server, so the suite fails if
 * `next build` output is broken rather than only the development bundle.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * The server needs a complete, valid environment now that the root layout resolves a
 * session on every request — an invalid one means every page, including the login screen,
 * answers 500.
 *
 * These placeholders make the public checks runnable on a development machine with no
 * database. They are syntactically valid and functionally useless: the host does not
 * resolve, so nothing here can accidentally reach a real service. The one value that
 * matters, DATABASE_URL, is only ever the database the caller explicitly nominated.
 */
const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: "production",
  APP_URL: baseURL,
  DATABASE_URL:
    e2eDatabaseUrl() ??
    "postgresql://unused:unused@unreachable.invalid:5432/unused?schema=public",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "playwright-only-secret-not-used-anywhere-else-0123456789",
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? "unreachable.invalid",
  MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ?? "unused",
  MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ?? "unused",
  MINIO_BUCKET_PRIVATE: process.env.MINIO_BUCKET_PRIVATE ?? "unused",
  // Never `cloudflare` here: the suite talks to the server directly, so a request could
  // set CF-Connecting-IP itself and the audit trail would record whatever it claimed.
  TRUSTED_PROXY: "none",
  DEMO_MODE: "false",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    /*
     * Signs in once and caches the session, rather than each spec driving the login form.
     * A setup project rather than `globalSetup` because this one needs the server to be
     * up: `globalSetup` has no such guarantee, and the resulting failure would look like a
     * broken login rather than a race.
     */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `${baseURL}/login`,
    env: serverEnv,
    /**
     * Off by default, including locally.
     *
     * `reuseExistingServer` skips the whole command — build included — whenever something
     * already answers on the port. A second local run therefore tested the *previous*
     * build while appearing to test the current code, which is the failure mode a smoke
     * suite can least afford. Set PLAYWRIGHT_REUSE_SERVER=1 to opt into the fast loop
     * when you know the running server is current.
     */
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
