import { resolve } from "node:path";

/** Where the signed-in session is cached between the setup project and the specs. */
export const STORAGE_STATE = resolve(".playwright/owner.json");

/**
 * The end-to-end owner.
 *
 * Fixed and committed on purpose: these credentials only ever reach a throwaway database
 * that the suite creates and CI destroys. Read them as a promise instead — nothing in this
 * repository may ever hold a credential that works against a real hostel.
 */
export const E2E_OWNER = {
  email: "e2e-owner@hostelflow.test",
  password: "e2e-owner-password-2026",
  name: "E2E Owner",
} as const;

/**
 * The database the suite is allowed to destroy.
 *
 * A separate variable from DATABASE_URL, and never falling back to it, for the same reason
 * the integration harness refuses to: the first version of that harness read DATABASE_URL,
 * found a stray value in a developer shell, and pointed a migrating, seeding test run at
 * an unrelated production database that happened to be on the same machine. This suite
 * runs `migrate deploy` and `db:seed`, so the same mistake here would be worse.
 */
export function e2eDatabaseUrl(): string | null {
  const url = process.env.E2E_DATABASE_URL?.trim();
  return url ? url : null;
}

/** True when the suite may exercise screens that require a signed-in user. */
export function canRunAuthenticated(): boolean {
  return e2eDatabaseUrl() !== null;
}
