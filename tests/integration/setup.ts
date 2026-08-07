import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Shared harness for the database integration tests.
 *
 * These tests need a real PostgreSQL: they exist to prove things only a real database can
 * prove — that a unique index actually stops two concurrent bed claims, that a trigger
 * actually refuses an audit update, that a transaction actually rolls back. Mocking any of
 * that would only test the mock.
 *
 * **This suite reads TEST_DATABASE_URL, deliberately never DATABASE_URL.**
 *
 * It creates and deletes rows, so it must only ever point at a database someone has
 * explicitly nominated as disposable. `DATABASE_URL` is a common variable that is often
 * already set in a developer's shell — during this project it was found pointing at an
 * unrelated application's database — and a teardown helper that follows whatever happens
 * to be in the environment is a data-loss incident waiting for the schemas to line up.
 * Requiring a separate variable makes targeting a database an intentional act.
 *
 * The development machine has no database (see CLAUDE.md), so the suite skips when
 * TEST_DATABASE_URL is unset — loudly, never silently, so "did not run" can never be
 * mistaken for "passed". CI provides a PostgreSQL service container.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDatabase = Boolean(TEST_DATABASE_URL);

/**
 * The suite now exercises real application modules, and those build their own client from
 * `DATABASE_URL` via lib/server/db.ts. That quietly reopened the hole this file was
 * written to close: assertions read through `TEST_DATABASE_URL` while the code under test
 * writes through `DATABASE_URL`, so a developer with `DATABASE_URL` exported to a real
 * database would have residents, invoices, payments and undeletable audit rows written
 * into it while the tests looked green.
 *
 * They must therefore name the same database. Refusing loudly is the only safe answer:
 * the failure mode is silent writes to production.
 */
if (hasDatabase && process.env.DATABASE_URL) {
  const normalize = (url: string) => url.trim().replace(/\/+$/, "");

  if (normalize(process.env.DATABASE_URL) !== normalize(TEST_DATABASE_URL as string)) {
    throw new Error(
      "Refusing to run the integration suite.\n\n" +
        "DATABASE_URL and TEST_DATABASE_URL point at different databases. The modules\n" +
        "under test write through DATABASE_URL, so the suite would create and delete rows\n" +
        "in whatever that is — while asserting against the other one.\n\n" +
        "Set both to the same disposable database. Unsetting DATABASE_URL is not an\n" +
        "option: the modules under test build their client through lib/server/db.ts,\n" +
        "which also requires APP_URL, AUTH_SECRET, MINIO_ENDPOINT, MINIO_ROOT_USER,\n" +
        "MINIO_ROOT_PASSWORD and MINIO_BUCKET_PRIVATE. See the integration job in\n" +
        ".github/workflows/ci.yml for a working set of throwaway values.",
    );
  }
}

if (!hasDatabase) {
  console.warn(
    "\n" +
      "  ────────────────────────────────────────────────────────────────────\n" +
      "  TEST_DATABASE_URL is not set, so the integration suite is SKIPPED.\n" +
      "  These tests did NOT run. Nothing about the database is verified.\n" +
      "\n" +
      "  Point it at a DISPOSABLE database — this suite creates and deletes\n" +
      "  rows. It ignores DATABASE_URL on purpose so it can never run against\n" +
      "  a live application database by accident.\n" +
      "\n" +
      "    TEST_DATABASE_URL=postgresql://... npm run test:integration\n" +
      "  ────────────────────────────────────────────────────────────────────\n",
  );
}

let client: PrismaClient | null = null;

export function db(): PrismaClient {
  if (!TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
  });
  return client;
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect();
  client = null;

  // The application's own client, cached on globalThis by lib/server/db.ts, holds a
  // separate pg pool. Tests that exercise real server modules open it, and leaving it
  // open keeps the worker's event loop alive after the last assertion — vitest then
  // either hangs or force-terminates, and a force-terminated run is a run whose result
  // nobody should trust.
  try {
    const { prisma } = await import("@/lib/server/db");
    await prisma.$disconnect();
  } catch {
    // Never opened by this file, which is fine — nothing to close.
  }
}

/** Unique per test run, so parallel runs and reruns never collide on a slug or a CNIC. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestHostel {
  hostelId: string;
  roomTypeId: string;
  roomId: string;
  bedIds: string[];
  monthlyRentPkr: number;
}

/**
 * Builds an isolated hostel with one four-seater room. Each test gets its own tenant, so
 * a failure in one cannot cascade into another and the tenant-isolation tests have a
 * genuine second tenant to be denied access to.
 */
export async function createTestHostel(label = "test"): Promise<TestHostel> {
  const prisma = db();
  const slug = unique(label);

  const hostel = await prisma.hostel.create({
    data: {
      slug,
      name: `Test Hostel ${slug}`,
      addressLine: "1 Test Street",
      city: "Lahore",
    },
  });

  const floor = await prisma.floor.create({
    data: { hostelId: hostel.id, level: 0, name: "Ground floor" },
  });

  const roomType = await prisma.roomType.create({
    data: {
      hostelId: hostel.id,
      code: "FOUR_SEATER",
      name: "Four-seater",
      capacity: 4,
      monthlyRentPkr: 7500,
    },
  });

  const room = await prisma.room.create({
    data: {
      hostelId: hostel.id,
      floorId: floor.id,
      roomTypeId: roomType.id,
      number: "101",
    },
  });

  const bedIds: string[] = [];
  for (const label of ["A", "B", "C", "D"]) {
    const bed = await prisma.bed.create({
      data: { hostelId: hostel.id, roomId: room.id, label },
    });
    bedIds.push(bed.id);
  }

  return {
    hostelId: hostel.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    bedIds,
    monthlyRentPkr: roomType.monthlyRentPkr,
  };
}

export interface TestResident {
  residentId: string;
  admissionId: string;
}

/** Creates a resident with a live admission, ready to be allocated a bed. */
export async function createTestResident(
  hostelId: string,
  fullName = "Test Resident",
): Promise<TestResident> {
  const prisma = db();
  // 13 digits, clearly invented, and unique per call. Deriving it from Date.now() alone
  // meant two residents created in the same millisecond collided on the active-CNIC
  // unique index — a flaky failure in the tests that exist to prove that index works.
  const cnic = `9${String(Date.now()).slice(-7)}${String(
    Math.floor(Math.random() * 100000),
  ).padStart(5, "0")}`;

  const resident = await prisma.resident.create({
    data: {
      hostelId,
      fullName,
      cnicNormalized: cnic,
      activeCnicKey: cnic,
      phone: "03001234567",
      addressLine: "1 Test Street",
      city: "Lahore",
    },
  });

  const admission = await prisma.admission.create({
    data: {
      hostelId,
      residentId: resident.id,
      status: "ACTIVE",
      activeResidentId: resident.id,
      joiningDate: new Date(),
      agreedMonthlyRentPkr: 7500,
    },
  });

  return { residentId: resident.id, admissionId: admission.id };
}

/**
 * Removes a test hostel and everything under it.
 *
 * Audit rows are the exception: the schema pins them with ON DELETE RESTRICT and a
 * trigger refuses DELETE outright, which is the behaviour under test. They are left
 * behind deliberately — a test suite that could delete the audit trail would prove the
 * trail is deletable.
 */
export async function cleanupHostel(hostelId: string): Promise<void> {
  const prisma = db();

  await prisma.bedAllocation.deleteMany({ where: { hostelId } });
  await prisma.bedHold.deleteMany({ where: { hostelId } });
  await prisma.paymentAllocation.deleteMany({
    where: { payment: { hostelId } },
  });
  await prisma.paymentProofEvent.deleteMany({ where: { proof: { hostelId } } });
  await prisma.paymentProof.deleteMany({ where: { hostelId } });
  await prisma.payment.deleteMany({ where: { hostelId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { hostelId } } });
  await prisma.invoice.deleteMany({ where: { hostelId } });
  await prisma.securityDepositLedger.deleteMany({ where: { hostelId } });
  await prisma.damageDeduction.deleteMany({ where: { checkout: { hostelId } } });
  await prisma.checkout.deleteMany({ where: { hostelId } });
  await prisma.policeVerificationEvent.deleteMany({
    where: { verification: { hostelId } },
  });
  await prisma.policeVerification.deleteMany({ where: { hostelId } });
  await prisma.receipt.deleteMany({ where: { hostelId } });
  await prisma.maintenanceRequest.deleteMany({ where: { hostelId } });
  await prisma.notification.deleteMany({ where: { hostelId } });
  await prisma.enquiryEvent.deleteMany({ where: { enquiry: { hostelId } } });
  await prisma.enquiry.deleteMany({ where: { hostelId } });
  await prisma.admission.deleteMany({ where: { hostelId } });
  await prisma.residentDocument.deleteMany({
    where: { resident: { hostelId } },
  });
  await prisma.guardian.deleteMany({ where: { resident: { hostelId } } });
  await prisma.resident.deleteMany({ where: { hostelId } });
  await prisma.documentAccessLog.deleteMany({ where: { object: { hostelId } } });
  await prisma.storedObject.deleteMany({ where: { hostelId } });
  await prisma.bed.deleteMany({ where: { hostelId } });
  await prisma.room.deleteMany({ where: { hostelId } });
  await prisma.roomType.deleteMany({ where: { hostelId } });
  await prisma.floor.deleteMany({ where: { hostelId } });
  await prisma.chargeType.deleteMany({ where: { hostelId } });
  await prisma.hostelMembership.deleteMany({ where: { hostelId } });

  // Only removable once no audit row references it, which is the intended constraint.
  const auditCount = await prisma.auditLog.count({ where: { hostelId } });
  if (auditCount === 0) {
    await prisma.hostel.delete({ where: { id: hostelId } });
  }
}
