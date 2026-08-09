"use client";

import { createAuthClient } from "better-auth/react";

/**
 * The browser half of Better Auth.
 *
 * Deliberately thin. It signs in, signs out, and reports whether a session cookie is
 * present — nothing more. In particular it never learns a role: `useSession()` returns the
 * user record, and the user record carries no authority. Role and hostel are resolved on
 * the server from `HostelMembership` on every request (see `lib/server/authz.ts`), so a
 * value tampered with in the browser changes what is *drawn* and never what is *permitted*.
 *
 * That distinction is the whole point of this milestone. The previous build kept the role
 * in `localStorage`, which meant one line in a device console promoted a resident to owner.
 *
 * No `baseURL`: the client calls the same origin it was served from, so a preview
 * deployment or the tunnel hostname works without rebuilding.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
