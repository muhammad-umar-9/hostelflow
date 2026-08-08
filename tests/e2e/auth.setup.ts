import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { E2E_OWNER, EMPTY_SESSION, STORAGE_STATE, e2eDatabaseUrl } from "./config";

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
    // Under CI a skip is a failure. The guard that used to live in ci.yml tested a
    // variable the same workflow set twenty lines above, so it could never fire — it
    // asserted a fact about the YAML rather than about the run, and would have stayed
    // green while the postgres service failed its health check and every authenticated
    // screen skipped. The assertion belongs where the truth is.
    if (process.env.CI) {
      throw new Error(
        "E2E_DATABASE_URL is not set under CI. The authenticated screens would skip, " +
          "and a skipped suite is indistinguishable from a passing one in the summary.",
      );
    }

    writeFileSync(STORAGE_STATE, JSON.stringify(EMPTY_SESSION));
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
      E2E_OWNER_NAME: E2E_OWNER.name,
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

  // The seeded hostel's name, which renders only once the session resolved and the page
  // loaded its data. The previous assertion was `expect(h1).toBeVisible()`, which the
  // login screen's own "HostelFlow" heading would also have satisfied — it proved a
  // heading element exists, while the comment above it claimed to prove the hostel had
  // loaded. A comment describing a stronger check than the code performs is worse than no
  // comment.
  await expect(page.locator("h1").first()).toHaveText(/H-K Boys Hostel/i, {
    timeout: 30_000,
  });

  await page.context().storageState({ path: STORAGE_STATE });
});
