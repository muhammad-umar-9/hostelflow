import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { E2E_OWNER, STORAGE_STATE, e2eDatabaseUrl } from "./config";

/**
 * Provisions a throwaway hostel and signs in through the real login form.
 *
 * The smoke suite used to walk twenty authenticated screens without authenticating,
 * because there was nothing to authenticate against. Now that sign-in is real, the choice
 * was between weakening the application so the tests still pass and making the tests do
 * what a person does. This does the latter: it migrates a database, seeds the structural
 * data, creates one owner, and drives the actual form — so the suite now also proves that
 * signing in works at all, which nothing previously checked.
 *
 * Without E2E_DATABASE_URL it writes an empty session and the authenticated specs skip
 * themselves. That keeps `npm run test:e2e` useful on a development machine, where
 * PostgreSQL deliberately does not exist, while making "not run" impossible to mistake for
 * "passed".
 */
setup("provision a hostel and sign in", async ({ page, baseURL }) => {
  const databaseUrl = e2eDatabaseUrl();

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });

  if (!databaseUrl) {
    writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(
      true,
      "E2E_DATABASE_URL is not set — authenticated screens will be skipped, not passed.",
    );
    return;
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const run = (args: string[]) =>
    execFileSync("npm", ["run", ...args], { env, stdio: "inherit", shell: true });

  run(["db:migrate:deploy"]);
  run(["db:seed"]);

  // Idempotent: re-running the suite against a surviving database must not fail on a
  // duplicate owner, and must not silently sign in as a stale one either.
  execFileSync("npx", ["tsx", "scripts/e2e-owner.ts"], {
    env: {
      ...env,
      E2E_OWNER_EMAIL: E2E_OWNER.email,
      E2E_OWNER_PASSWORD: E2E_OWNER.password,
    },
    stdio: "inherit",
    shell: true,
  });

  await page.goto("/login");
  await page.getByLabel("EMAIL").fill(E2E_OWNER.email);
  await page.getByLabel("PASSWORD").fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The destination is decided by the server from the membership, so landing on the
  // dashboard is itself the assertion that an OWNER membership was resolved.
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 30_000 });

  // The seeded hostel's name, which only renders once the session resolved and the page
  // loaded its data. `getByRole("heading")` matched three elements and failed on strict
  // mode — an assertion vague enough to be ambiguous is too vague to prove anything.
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
