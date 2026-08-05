import { describe, expect, it } from "vitest";
import {
  MANAGER_PERMISSIONS,
  type Permission,
  hasPermission,
} from "@/lib/domain/permissions";
import { MembershipRole } from "@/lib/generated/prisma/enums";

const NO_OVERRIDES: Record<string, boolean> = {};

const ALL_PERMISSIONS: Permission[] = [
  "residents.read",
  "residents.write",
  "residents.viewFullCnic",
  "beds.allocate",
  "beds.move",
  "payments.record",
  "payments.approve",
  "payments.reverse",
  "police.update",
  "checkout.start",
  "checkout.approve",
  "settings.manage",
  "audit.read",
];

describe("owner", () => {
  it("holds every permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(MembershipRole.OWNER, NO_OVERRIDES, permission)).toBe(true);
    }
  });

  it("cannot be stripped by an override", () => {
    expect(
      hasPermission(
        MembershipRole.OWNER,
        { "settings.manage": false },
        "settings.manage",
      ),
    ).toBe(true);
  });
});

describe("manager", () => {
  it("holds the front-desk set", () => {
    for (const permission of MANAGER_PERMISSIONS) {
      expect(hasPermission(MembershipRole.MANAGER, NO_OVERRIDES, permission)).toBe(true);
    }
  });

  it("cannot reverse a verified payment", () => {
    expect(hasPermission(MembershipRole.MANAGER, NO_OVERRIDES, "payments.reverse")).toBe(
      false,
    );
  });

  it("cannot approve a checkout deduction, change settings or read the audit log", () => {
    const ownerOnly: Permission[] = ["checkout.approve", "settings.manage", "audit.read"];
    for (const permission of ownerOnly) {
      expect(hasPermission(MembershipRole.MANAGER, NO_OVERRIDES, permission)).toBe(false);
    }
  });

  it("loses a default permission when the owner switches it off", () => {
    expect(
      hasPermission(
        MembershipRole.MANAGER,
        { "payments.approve": false },
        "payments.approve",
      ),
    ).toBe(false);
  });

  it("gains an owner-only permission only when explicitly granted", () => {
    expect(
      hasPermission(
        MembershipRole.MANAGER,
        { "payments.reverse": true },
        "payments.reverse",
      ),
    ).toBe(true);
  });
});

describe("resident", () => {
  it("holds no staff permission at all", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(MembershipRole.RESIDENT, NO_OVERRIDES, permission)).toBe(
        false,
      );
    }
  });

  it("cannot be promoted by an override, which is the point of checking the role first", () => {
    expect(
      hasPermission(
        MembershipRole.RESIDENT,
        { "payments.approve": true, "settings.manage": true },
        "payments.approve",
      ),
    ).toBe(false);
  });
});

describe("unknown permissions", () => {
  it("are denied for a manager rather than assumed", () => {
    expect(
      hasPermission(
        MembershipRole.MANAGER,
        NO_OVERRIDES,
        "future.capability" as Permission,
      ),
    ).toBe(false);
  });
});
