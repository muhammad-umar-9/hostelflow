import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupHostel,
  createTestHostel,
  db,
  disconnect,
  hasDatabase,
  type TestHostel,
} from "./setup";

/**
 * The admission workflow, end to end against a real PostgreSQL.
 *
 * These tests exercise the transaction directly rather than through a route, because what
 * needs proving is what the database does: that the money is right, that the writes are
 * atomic, and that two managers clicking "allocate" on the same bed at the same instant
 * produce exactly one resident in it.
 *
 * The authorization context is passed in, so the transaction is tested without standing up
 * a session. Authorization itself is covered in the authz tests.
 */
describe.skipIf(!hasDatabase)("admitting a resident", () => {
  let hostel: TestHostel;
  let context: {
    user: { id: string; name: string; email: string };
    membership: { hostelId: string; role: "OWNER"; permissions: Record<string, boolean> };
  };

  /** The pilot's configuration, created per test so nothing is shared. */
  async function seedCharges(hostelId: string) {
    const prisma = db();
    await prisma.chargeType.createMany({
      data: [
        {
          hostelId,
          code: "SECURITY_DEPOSIT",
          label: "Refundable security deposit",
          kind: "SECURITY_DEPOSIT",
          defaultAmountPkr: 3000,
          oneTime: true,
        },
        {
          hostelId,
          code: "POLICE_FORM",
          label: "Police form charge (one time)",
          kind: "POLICE_FORM",
          defaultAmountPkr: 300,
          oneTime: true,
        },
      ],
    });
  }

  function admissionInput(bedId: string, overrides: Record<string, unknown> = {}) {
    return {
      bedId,
      joiningDate: new Date("2026-08-10T00:00:00Z"),
      resident: {
        fullName: "Ali Raza",
        // 13 digits, unique per call so the active-CNIC index is not tripped by reuse.
        cnic: `9${String(Date.now()).slice(-7)}${String(
          Math.floor(Math.random() * 100000),
        ).padStart(5, "0")}`,
        phone: "0300 1234567",
        addressLine: "House 1, Demo Street",
        city: "Lahore",
        institution: "Punjab University",
        occupation: "STUDENT" as const,
      },
      guardian: {
        fullName: "Raza Senior",
        relationship: "Father",
        phone: "0321 1234567",
      },
      payment: {
        method: "CASH" as const,
        amountPkr: 10_800,
        paidAt: new Date(),
      },
      documentIds: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    const prisma = db();
    hostel = await createTestHostel("admit");
    await seedCharges(hostel.hostelId);

    const user = await prisma.user.create({
      data: {
        name: "Manager Under Test",
        email: `manager-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
      },
    });
    await prisma.hostelMembership.create({
      data: {
        hostelId: hostel.hostelId,
        userId: user.id,
        role: "OWNER",
        activeUserId: user.id,
      },
    });

    context = {
      user: { id: user.id, name: user.name, email: user.email },
      membership: { hostelId: hostel.hostelId, role: "OWNER", permissions: {} },
    };
  });

  afterEach(async () => {
    await cleanupHostel(hostel.hostelId);
  });

  afterAll(async () => {
    await disconnect();
  });

  it("charges Rs 10,800 for a four-seater, computed from configuration", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const prisma = db();

    const result = await admitResident(
      admissionInput(hostel.bedIds[0]),
      context as never,
    );

    // 7,500 rent + 3,000 deposit + 300 police form. None of it sent by the caller.
    expect(result.totalPkr).toBe(10_800);
    expect(result.receivedPkr).toBe(10_800);
    expect(result.balancePkr).toBe(0);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: result.invoiceId },
      include: { lines: true },
    });
    expect(invoice.status).toBe("PAID");
    expect(invoice.lines.map((line) => line.amountPkr).sort((a, b) => a - b)).toEqual([
      300, 3000, 7500,
    ]);
  });

  it("writes every record of the admission, or none", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const prisma = db();

    const result = await admitResident(
      admissionInput(hostel.bedIds[0]),
      context as never,
    );

    const [bed, allocation, deposit, police, receipt, audit] = await Promise.all([
      prisma.bed.findUniqueOrThrow({ where: { id: hostel.bedIds[0] } }),
      prisma.bedAllocation.findFirst({ where: { admissionId: result.admissionId } }),
      prisma.securityDepositLedger.findFirst({
        where: { admissionId: result.admissionId },
      }),
      prisma.policeVerification.findUnique({
        where: { admissionId: result.admissionId },
      }),
      prisma.receipt.findUniqueOrThrow({ where: { id: result.receiptId } }),
      prisma.auditLog.findFirst({
        where: { entityId: result.admissionId, action: "admission.confirmed" },
      }),
    ]);

    expect(bed.status).toBe("OCCUPIED");
    expect(allocation?.activeBedId).toBe(hostel.bedIds[0]);
    expect(deposit?.amountPkr).toBe(3000);
    // The police track starts independently of the police-form charge being paid.
    expect(police?.status).toBe("NOT_STARTED");
    expect(receipt.number).toMatch(/^RCP-\d{5}$/);
    expect(receipt.totalReceivedPkr).toBe(10_800);
    expect(audit).not.toBeNull();
  });

  it("records a part payment without pretending the invoice is settled", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const prisma = db();

    const result = await admitResident(
      admissionInput(hostel.bedIds[0], {
        payment: { method: "CASH", amountPkr: 8000, paidAt: new Date() },
      }),
      context as never,
    );

    expect(result.receivedPkr).toBe(8000);
    expect(result.balancePkr).toBe(2800);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: result.invoiceId },
    });
    expect(invoice.status).toBe("PARTIAL");

    // 8,000 settles 7,500 rent, then the 300 police form, leaving 200 towards the
    // refundable deposit. The hostel is short of money it holds rather than money it has
    // earned, which is the right way round.
    const deposit = await prisma.securityDepositLedger.findFirst({
      where: { admissionId: result.admissionId },
    });
    expect(deposit?.amountPkr).toBe(200);
  });

  it("gives exactly one winner when two admissions race for the same bed", async () => {
    const { admitResident, BedUnavailableError } =
      await import("@/lib/server/admissions");
    const prisma = db();
    const bedId = hostel.bedIds[0];

    const results = await Promise.allSettled([
      admitResident(admissionInput(bedId), context as never),
      admitResident(
        admissionInput(bedId, {
          resident: { ...admissionInput(bedId).resident, fullName: "Hamza Khan" },
        }),
        context as never,
      ),
    ]);

    const winners = results.filter((r) => r.status === "fulfilled");
    const losers = results.filter((r) => r.status === "rejected");

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    // The loser gets an actionable error, not a raw database fault.
    const reason = (losers[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(BedUnavailableError);

    // And the losing transaction left nothing behind.
    expect(await prisma.bedAllocation.count({ where: { bedId } })).toBe(1);
    expect(await prisma.resident.count({ where: { hostelId: hostel.hostelId } })).toBe(1);
    expect(await prisma.invoice.count({ where: { hostelId: hostel.hostelId } })).toBe(1);
  });

  it("refuses a bed that is already occupied", async () => {
    const { admitResident, BedUnavailableError } =
      await import("@/lib/server/admissions");

    await admitResident(admissionInput(hostel.bedIds[0]), context as never);

    await expect(
      admitResident(admissionInput(hostel.bedIds[0]), context as never),
    ).rejects.toBeInstanceOf(BedUnavailableError);
  });

  it("refuses a second active resident with the same CNIC", async () => {
    const { admitResident, DuplicateResidentError } =
      await import("@/lib/server/admissions");

    const first = admissionInput(hostel.bedIds[0]);
    await admitResident(first, context as never);

    await expect(
      admitResident(
        { ...admissionInput(hostel.bedIds[1]), resident: first.resident },
        context as never,
      ),
    ).rejects.toBeInstanceOf(DuplicateResidentError);
  });

  it("issues sequential document numbers under concurrency", async () => {
    const { admitResident } = await import("@/lib/server/admissions");

    const results = await Promise.all([
      admitResident(admissionInput(hostel.bedIds[0]), context as never),
      admitResident(admissionInput(hostel.bedIds[1]), context as never),
      admitResident(admissionInput(hostel.bedIds[2]), context as never),
    ]);

    // Derived from an atomic UPDATE ... RETURNING, so three concurrent admissions get
    // three distinct numbers rather than colliding on the unique index.
    const numbers = results.map((r) => r.receiptNumber);
    expect(new Set(numbers).size).toBe(3);
  });

  it("refuses more money than the admission costs, rather than losing the difference", async () => {
    const { admitResident, OverpaymentError } = await import("@/lib/server/admissions");

    await expect(
      admitResident(
        admissionInput(hostel.bedIds[0], {
          payment: { method: "CASH", amountPkr: 12_000, paidAt: new Date() },
        }),
        context as never,
      ),
    ).rejects.toBeInstanceOf(OverpaymentError);

    // Nothing was written: no half-admitted resident holding a bed.
    const prisma = db();
    expect(await prisma.resident.count({ where: { hostelId: hostel.hostelId } })).toBe(0);
    const bed = await prisma.bed.findUniqueOrThrow({ where: { id: hostel.bedIds[0] } });
    expect(bed.status).toBe("VACANT");
  });

  it("applies a part payment to rent before the refundable deposit", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const prisma = db();

    // Rs 8,000 against 7,500 rent + 300 police + 3,000 deposit. Rent and the police form
    // are settled first, leaving 200 towards the deposit — not 3,000, which is what an
    // unordered allocation could have recorded and then owed back at checkout.
    const result = await admitResident(
      admissionInput(hostel.bedIds[0], {
        payment: { method: "CASH", amountPkr: 8000, paidAt: new Date() },
      }),
      context as never,
    );

    const deposit = await prisma.securityDepositLedger.findFirst({
      where: { admissionId: result.admissionId },
    });
    expect(deposit?.amountPkr).toBe(200);
    expect(result.balancePkr).toBe(2800);
  });

  it("refuses a document id that does not resolve, rather than admitting without it", async () => {
    const { admitResident, MissingDocumentError } =
      await import("@/lib/server/admissions");

    await expect(
      admitResident(
        admissionInput(hostel.bedIds[0], { documentIds: ["does-not-exist"] }),
        context as never,
      ),
    ).rejects.toBeInstanceOf(MissingDocumentError);
  });

  it("refuses a caller whose context lacks the bed-allocation permission", async () => {
    const { admitResident } = await import("@/lib/server/admissions");

    // A manager whose owner switched off beds.allocate. Supplying the context must not
    // be a way around the permission check.
    const restricted = {
      user: context.user,
      membership: {
        hostelId: hostel.hostelId,
        role: "MANAGER",
        permissions: { "beds.allocate": false },
      },
    };

    await expect(
      admitResident(admissionInput(hostel.bedIds[0]), restricted as never),
    ).rejects.toThrow();

    const prisma = db();
    expect(await prisma.resident.count({ where: { hostelId: hostel.hostelId } })).toBe(0);
  });

  it("refuses a non-cash payment when the caller cannot approve payments", async () => {
    const { admitResident } = await import("@/lib/server/admissions");

    // Cash at the desk is verified by the act of taking it. A bank transfer is a claim
    // until someone reconciles it, which is what the proof queue is for.
    const frontDesk = {
      user: context.user,
      membership: {
        hostelId: hostel.hostelId,
        role: "MANAGER",
        permissions: { "payments.approve": false },
      },
    };

    await expect(
      admitResident(
        admissionInput(hostel.bedIds[0], {
          payment: { method: "BANK_TRANSFER", amountPkr: 10_800, paidAt: new Date() },
        }),
        frontDesk as never,
      ),
    ).rejects.toThrow(/payment-approval/i);

    // The same manager may still admit against cash.
    const ok = await admitResident(admissionInput(hostel.bedIds[0]), frontDesk as never);
    expect(ok.receivedPkr).toBe(10_800);
  });

  it("refuses to admit when an active charge has no amount configured", async () => {
    const { admitResident, ChargeConfigurationError } =
      await import("@/lib/server/admissions");
    const prisma = db();

    // Active, but with no amount. Previously the deposit silently vanished from the
    // invoice, the total and the ledger — money never charged and later owed back.
    await prisma.chargeType.updateMany({
      where: { hostelId: hostel.hostelId, kind: "SECURITY_DEPOSIT" },
      data: { defaultAmountPkr: null },
    });

    await expect(
      admitResident(admissionInput(hostel.bedIds[0]), context as never),
    ).rejects.toBeInstanceOf(ChargeConfigurationError);
  });

  it("treats a repeated document id as one document, not as a missing one", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const prisma = db();

    const object = await prisma.storedObject.create({
      data: {
        hostelId: hostel.hostelId,
        kind: "CNIC_FRONT",
        objectKey: `hostel/${hostel.hostelId}/cnic_front/${Math.random().toString(36).slice(2)}.jpg`,
        bucket: "test",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      },
    });

    const result = await admitResident(
      admissionInput(hostel.bedIds[0], { documentIds: [object.id, object.id] }),
      context as never,
    );

    const attached = await prisma.residentDocument.count({
      where: { residentId: result.residentId },
    });
    expect(attached).toBe(1);
  });

  it("refuses a bed belonging to another hostel", async () => {
    const { admitResident } = await import("@/lib/server/admissions");
    const other = await createTestHostel("admit-other");

    try {
      await expect(
        admitResident(admissionInput(other.bedIds[0]), context as never),
      ).rejects.toThrow();

      // Nothing was created in either hostel.
      const prisma = db();
      expect(await prisma.resident.count({ where: { hostelId: hostel.hostelId } })).toBe(
        0,
      );
    } finally {
      await cleanupHostel(other.hostelId);
    }
  });
});
