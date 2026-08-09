import { STORAGE_STATE, e2eDatabaseUrl } from "../../playwright.config";

export { STORAGE_STATE, e2eDatabaseUrl };

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
 * A deliberately signed-out browser state.
 *
 * Written to disk by the setup project when there is no database, and passed to
 * `test.use()` by every spec that must not carry the cached owner session. Named once so
 * the three copies cannot drift, and so a reader can see they are the same concept.
 */
export const EMPTY_SESSION: { cookies: []; origins: [] } = {
  cookies: [],
  origins: [],
};

/** True when the suite may exercise screens that require a signed-in user. */
export function canRunAuthenticated(): boolean {
  return e2eDatabaseUrl() !== null;
}
