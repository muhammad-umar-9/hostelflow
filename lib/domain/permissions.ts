import { MembershipRole } from "@/lib/generated/prisma/enums";

/**
 * What each role may do.
 *
 * Two properties this deliberately has:
 *
 *   * **Deny by default.** An unrecognized permission is refused. Adding a new capability
 *     therefore never grants itself to every existing manager as a side effect.
 *   * **An owner's explicit `false` always wins.** Per-manager overrides stored on
 *     HostelMembership.permissions can only ever be consulted after the role check, so an
 *     override cannot promote a resident into staff.
 *
 * Pure, so it can be unit tested. lib/server/authz.ts resolves the membership from the
 * session and then asks this module.
 */

export type Permission =
  | "residents.read"
  | "residents.write"
  | "residents.viewFullCnic"
  | "beds.allocate"
  | "beds.move"
  | "payments.record"
  | "payments.approve"
  | "payments.reverse"
  | "police.update"
  | "checkout.start"
  | "checkout.approve"
  | "settings.manage"
  | "audit.read";

/**
 * The default manager set. Note what is absent and owner-only: reversing a verified
 * payment, approving a checkout deduction, changing prices and settings, and reading the
 * audit log. A manager runs the front desk; they do not get to quietly undo money.
 */
export const MANAGER_PERMISSIONS: readonly Permission[] = [
  "residents.read",
  "residents.write",
  "residents.viewFullCnic",
  "beds.allocate",
  "beds.move",
  "payments.record",
  "payments.approve",
  "police.update",
  "checkout.start",
];

/** What a resident may do inside the companion portal, on their own records only. */
export const RESIDENT_PERMISSIONS: readonly Permission[] = [];

export function hasPermission(
  role: MembershipRole,
  overrides: Readonly<Record<string, boolean>>,
  permission: Permission,
): boolean {
  if (role === MembershipRole.OWNER) return true;
  if (role !== MembershipRole.MANAGER) return false;

  const override = overrides[permission];
  if (typeof override === "boolean") return override;

  return MANAGER_PERMISSIONS.includes(permission);
}
