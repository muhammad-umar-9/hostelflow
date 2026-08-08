import "server-only";

import { cache } from "react";

import { MembershipRole } from "@/lib/generated/prisma/enums";
import type { Role } from "@/lib/types";
import { getCurrentUser } from "./authz";
import { prisma } from "./db";
import { rethrowFrameworkSignal } from "./dynamic";

/**
 * Who is looking at the screen, for rendering purposes only.
 *
 * This is the presentation counterpart to `authz.ts`, and the split is deliberate:
 *
 *   * `authz.ts` **decides**. Its helpers throw, so a forgotten check fails closed.
 *   * `viewer.ts` **describes**. It never throws and never grants anything. It answers
 *     "which navigation items should this person see" — a question about pixels.
 *
 * Nothing here may be used to authorize an action. A screen that renders an owner-only
 * button because `role === "owner"` must still call `requireOwner()` in the action behind
 * it, because the button is drawn on a machine we do not control.
 *
 * The value it replaced was read from `localStorage`, so this is a real reduction in
 * privilege even though the shape looks similar.
 */
export interface Viewer {
  signedIn: boolean;
  role: Role;
  name: string | null;
  hostelId: string | null;
}

/** The signed-out default. Renders the resident-shaped, least-privileged navigation. */
const ANONYMOUS: Viewer = {
  signedIn: false,
  role: "resident",
  name: null,
  hostelId: null,
};

const ROLE_BY_MEMBERSHIP: Record<MembershipRole, Role> = {
  [MembershipRole.OWNER]: "owner",
  [MembershipRole.MANAGER]: "manager",
  [MembershipRole.RESIDENT]: "resident",
};

/**
 * Resolves the viewer, or the anonymous default.
 *
 * Never throws: it runs in the root layout, and a layout that throws takes down the login
 * screen too — locking everybody out of the only page that could fix the problem.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getCurrentUser().catch(tolerate);
  if (!user) return ANONYMOUS;

  const membership = await prisma.hostelMembership
    .findFirst({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: { hostelId: true, role: true },
    })
    .catch(tolerate);

  // Signed in with no membership is a real state, not an error: it is what a resident who
  // has authenticated only to upload their documents looks like. They get the least
  // privileged navigation and every hostel query refuses them by name.
  if (!membership) {
    return { signedIn: true, role: "resident", name: user.name || null, hostelId: null };
  }

  return {
    signedIn: true,
    // Falls back to the least privileged role rather than `undefined`. A fourth
    // MembershipRole added by a later migration, or a generated client lagging the
    // deployed schema, would otherwise produce `undefined` — and every downstream branch
    // is written as `role === "resident" ? … : staff`, so an unknown role would have been
    // shown the staff navigation. An unrecognised role must fail closed.
    role: ROLE_BY_MEMBERSHIP[membership.role] ?? "resident",
    name: user.name || null,
    hostelId: membership.hostelId,
  };
});

/** Where a viewer belongs after signing in. */
export function homePathFor(viewer: Viewer): string {
  if (!viewer.signedIn) return "/login";
  return viewer.role === "resident" ? "/resident-portal" : "/dashboard";
}

/**
 * Treats a lookup failure as "nobody is signed in", loudly, and never absorbs a framework
 * control-flow signal.
 *
 * Two things must not happen here. Next's static-generation bailout has to propagate, or
 * every authenticated route prerenders as static HTML with the anonymous navigation baked
 * in and the build still reports success. And a genuine infrastructure failure — a
 * database failover, an exhausted pool — must not pass silently: it downgrades a live
 * owner to the resident view, sends them to /resident-portal, and tells them their own
 * checkout needs the owner's approval. That is a support call with no diagnostic trail
 * unless it is logged, so it is logged.
 */
function tolerate(error: unknown): null {
  rethrowFrameworkSignal(error);
  console.error(
    "[viewer] session or membership lookup failed; rendering as signed out",
    error,
  );
  return null;
}
