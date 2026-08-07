import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests run against a production build, not the dev server, so the suite fails if
 * `next build` output is broken rather than only the development bundle.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

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
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
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
