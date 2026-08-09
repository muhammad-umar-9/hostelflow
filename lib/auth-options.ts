import type { BetterAuthOptions } from "better-auth";

/**
 * The Better Auth settings that must be identical everywhere an account is created or
 * verified.
 *
 * Deliberately **not** marked `server-only`, unlike the rest of `lib/server/`. The owner
 * bootstrap and the end-to-end fixture are plain Node scripts run through `tsx`, which
 * resolves `server-only` to the module that throws — Next aliases it away, a CLI cannot.
 * The bootstrap script worked around that by writing its own copy of this configuration,
 * and a second copy was about to be written for the test fixture.
 *
 * Three copies of the settings that decide how a password is hashed is how you end up with
 * a bootstrap that creates an account the application then refuses to authenticate, with
 * nothing in any log to explain it. So the shared part lives here, in one place, and the
 * differences stay visible at the call sites.
 *
 * What is intentionally absent: `disableSignUp`, session lifetimes, cookie attributes,
 * rate limits and plugins. Those are properties of the *running application* and are set
 * in `lib/server/auth.ts`. A CLI that creates the very first owner must be able to sign up
 * exactly once, which is precisely what the application forbids.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function sharedAuthOptions(input: {
  baseURL: string;
  secret: string;
  database: BetterAuthOptions["database"];
}): BetterAuthOptions {
  return {
    appName: "HostelFlow",
    baseURL: input.baseURL,
    secret: input.secret,
    database: input.database,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      // No email transport is configured, so password reset is owner-driven for now.
      // Enabling verification without a transport produces a flow that never delivers.
      requireEmailVerification: false,
    },
    telemetry: { enabled: false },
  };
}
