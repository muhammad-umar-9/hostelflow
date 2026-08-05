import "server-only";

import { headers } from "next/headers";
import {
  hasPermission as hasPermissionForRole,
  type Permission,
} from "@/lib/domain/permissions";
import { MembershipRole } from "@/lib/generated/prisma/enums";
import { auth } from "./auth";
import { prisma } from "./db";

/**
 * Server-side authorization.
 *
 * Three rules the rest of the application depends on:
 *
 *   1. **The server decides.** Role and hostel are read from HostelMembership on every
 *      request. Nothing is trusted from a cookie, a header, a form field or a query
 *      parameter, and hiding a button is not authorization.
 *   2. **Denial throws.** Every helper here throws a typed error rather than returning a
 *      boolean, because a boolean can be ignored by forgetting an `if`. A missing check
 *      fails closed.
 *   3. **Not found, not forbidden.** A record belonging to another hostel is reported as
 *      missing. Answering "forbidden" would confirm that the id exists, which is a
 *      membership oracle across tenants.
 */

export type { Permission };

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Sign in to continue") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to do that") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Thrown when a record does not exist, or exists in another hostel. */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface ActiveMembership {
  hostelId: string;
  role: MembershipRole;
  permissions: Record<string, boolean>;
}

export interface AuthContext {
  user: AuthenticatedUser;
  membership: ActiveMembership;
}

/** The signed-in user, or null. Never throws, for screens that render both ways. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // A disabled account may still hold a valid session cookie until it expires, so the
  // flag is checked on every request rather than only at sign-in.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;

  return { id: user.id, name: user.name, email: user.email };
}

/** The signed-in user, or 401. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

function parsePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") result[key] = value;
  }
  return result;
}

/**
 * Resolves the signed-in user's membership.
 *
 * `hostelId` is optional because a user belongs to exactly one hostel in this release.
 * When it is supplied — for example from a route parameter — it must match the
 * membership, otherwise the request is treated as a request for something that does not
 * exist.
 */
export async function requireMembership(options?: {
  hostelId?: string;
  roles?: readonly MembershipRole[];
}): Promise<AuthContext> {
  const user = await requireUser();

  // When a hostel is named, select on it rather than fetching an arbitrary membership and
  // comparing afterwards. The schema's @@unique([hostelId, userId]) permits a user to
  // belong to several hostels, so an unordered findFirst would pick a nondeterministic
  // one and then 404 a hostel the user is genuinely a member of.
  const membership = await prisma.hostelMembership.findFirst({
    where: {
      userId: user.id,
      revokedAt: null,
      ...(options?.hostelId ? { hostelId: options.hostelId } : {}),
    },
    // Deterministic when no hostel is named and the user has more than one membership:
    // the oldest wins, consistently, rather than whatever the planner returns first.
    orderBy: { createdAt: "asc" },
    select: { hostelId: true, role: true, permissions: true },
  });

  if (!membership) {
    // Named hostel with no membership reads as missing, not forbidden, so this cannot be
    // used to discover which hostels exist.
    if (options?.hostelId) throw new NotFoundError();
    throw new AuthorizationError("Your account is not linked to a hostel");
  }

  if (options?.roles && !options.roles.includes(membership.role)) {
    throw new AuthorizationError();
  }

  return {
    user,
    membership: {
      hostelId: membership.hostelId,
      role: membership.role,
      permissions: parsePermissions(membership.permissions),
    },
  };
}

/** Owner only. Pricing, manager accounts, audit log, sensitive checkout approval. */
export function requireOwner(): Promise<AuthContext> {
  return requireMembership({ roles: [MembershipRole.OWNER] });
}

/** Owner or manager. The staff surface: rooms, residents, payments, police, checkout. */
export function requireStaff(): Promise<AuthContext> {
  return requireMembership({
    roles: [MembershipRole.OWNER, MembershipRole.MANAGER],
  });
}

/**
 * Confirms a loaded record belongs to the caller's hostel.
 *
 * Call this on every record fetched by an id that came from outside the server —
 * a route parameter, a form field, a request body. Fetching by id and rendering the
 * result is how one hostel ends up reading another's residents.
 */
export function assertSameHostel<T extends { hostelId: string }>(
  record: T | null | undefined,
  membership: ActiveMembership,
): T {
  if (!record || record.hostelId !== membership.hostelId) throw new NotFoundError();
  return record;
}

/**
 * A `where` fragment that scopes a query to the caller's hostel. Preferred over checking
 * after the fact, because it never loads the other tenant's row in the first place.
 */
export function hostelScope(membership: ActiveMembership): { hostelId: string } {
  return { hostelId: membership.hostelId };
}

/**
 * Whether the caller holds a named permission. The matrix itself lives in
 * lib/domain/permissions.ts, which is pure and unit tested.
 */
export function hasPermission(
  membership: ActiveMembership,
  permission: Permission,
): boolean {
  return hasPermissionForRole(membership.role, membership.permissions, permission);
}

/** Staff plus a named permission, or 403. */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const context = await requireStaff();
  if (!hasPermission(context.membership, permission)) throw new AuthorizationError();
  return context;
}

/**
 * The resident record the signed-in resident owns.
 *
 * A resident never passes a resident id: it is derived from their session. That removes
 * the whole class of bug where changing `?id=` in the address bar shows someone else's
 * invoices and CNIC images.
 */
export async function requireResidentSelf(): Promise<
  AuthContext & { residentId: string }
> {
  const context = await requireMembership({ roles: [MembershipRole.RESIDENT] });

  const resident = await prisma.resident.findFirst({
    where: { userId: context.user.id, hostelId: context.membership.hostelId },
    select: { id: true },
  });
  if (!resident) throw new AuthorizationError("No resident profile is linked to you");

  return { ...context, residentId: resident.id };
}

/**
 * Staff may read any resident in their own hostel; a resident may read only themselves.
 * Returns the resident id the caller is allowed to act on.
 */
export async function authorizeResidentAccess(
  residentId: string,
): Promise<{ context: AuthContext; residentId: string }> {
  const context = await requireMembership();

  if (context.membership.role === MembershipRole.RESIDENT) {
    const self = await prisma.resident.findFirst({
      where: { userId: context.user.id, hostelId: context.membership.hostelId },
      select: { id: true },
    });
    if (!self || self.id !== residentId) throw new NotFoundError();
    return { context, residentId };
  }

  const resident = await prisma.resident.findFirst({
    where: { id: residentId, hostelId: context.membership.hostelId },
    select: { id: true },
  });
  if (!resident) throw new NotFoundError();

  return { context, residentId };
}

/** Maps a thrown authorization error to an HTTP status for route handlers. */
export function statusForError(error: unknown): number {
  if (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof NotFoundError
  ) {
    return error.status;
  }
  return 500;
}
