import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { serverEnv } from "./env";

/**
 * Authentication.
 *
 * Better Auth was chosen over Auth.js; the reasoning is recorded in docs/architecture.md.
 * The short version: it ships email/password with its own scrypt hashing, database-backed
 * sessions and database-backed rate limiting, whereas Auth.js's Credentials provider
 * forces JWT sessions and leaves password hashing to the application. Phone OTP is a
 * documented plugin here, which is the upgrade path the specification asks us to keep open.
 *
 * Two things this deliberately does NOT do:
 *
 *   * No public sign-up. `disableSignUp` is on, so the only way an account comes into
 *     existence is the one-time owner bootstrap CLI or an owner inviting a manager. A
 *     hostel management system must never let a stranger register themselves into it.
 *   * No roles. Nothing about authorization lives on the user record. Role and hostel
 *     come from HostelMembership, resolved server-side on every request; see authz.ts.
 */

let cached: ReturnType<typeof createAuth> | null = null;

function createAuth() {
  const env = serverEnv();
  const isProduction = env.NODE_ENV === "production";

  return betterAuth({
    appName: "HostelFlow",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.APP_URL],

    database: prismaAdapter(prisma, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      // Accounts are created by the bootstrap CLI or by an owner, never self-service.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // No email transport is configured yet, so password reset is an in-person or
      // owner-driven operation for now. Enabling this without a transport would produce
      // a reset flow that silently never delivers.
      requireEmailVerification: false,
    },

    session: {
      // Eight hours: long enough for a working day at the front desk, short enough that
      // a shared desktop left signed in stops being useful overnight.
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      freshAge: 60 * 15,
    },

    advanced: {
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        path: "/",
      },
    },

    // Stored in PostgreSQL rather than in process memory, so limits survive a restart
    // and apply across every app container behind Caddy.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        // Credential stuffing is the realistic attack on a small hostel deployment.
        "/sign-in/email": { window: 300, max: 5 },
        "/forget-password": { window: 900, max: 3 },
        "/reset-password": { window: 900, max: 5 },
      },
    },

    telemetry: { enabled: false },

    // Must stay last: it lets Better Auth set cookies from server actions.
    plugins: [nextCookies()],
  });
}

/** The Better Auth instance. Created on first use so the build does not need secrets. */
export function auth() {
  cached ??= createAuth();
  return cached;
}

export type Auth = ReturnType<typeof createAuth>;
