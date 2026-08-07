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

/** True when the suite may exercise screens that require a signed-in user. */
export function canRunAuthenticated(): boolean {
  return e2eDatabaseUrl() !== null;
}
