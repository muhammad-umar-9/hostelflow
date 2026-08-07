import "server-only";

import { MembershipRole } from "@/lib/generated/prisma/enums";
import type { Role } from "@/lib/types";
import { getCurrentUser } from "./authz";
import { prisma } from "./db";
import { isDynamicBailout } from "./dynamic";

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
export async function getViewer(): Promise<Viewer> {
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
    role: ROLE_BY_MEMBERSHIP[membership.role],
    name: user.name || null,
    hostelId: membership.hostelId,
  };
}

/** Where a viewer belongs after signing in. */
export function homePathFor(viewer: Viewer): string {
  if (!viewer.signedIn) return "/login";
  return viewer.role === "resident" ? "/resident-portal" : "/dashboard";
}

/**
 * Treats a lookup failure as "nobody is signed in", except for the one error that must
 * never be absorbed.
 *
 * Without the rethrow, `headers()` throwing its static-generation bailout inside
 * `getCurrentUser` would be read as "signed out", and Next would happily prerender every
 * authenticated route as static HTML carrying the anonymous navigation. The build reports
 * that as success; the symptom only appears in production, as a site that never notices
 * anyone signing in.
 */
function tolerate(error: unknown): null {
  if (isDynamicBailout(error)) throw error;
  return null;
}
