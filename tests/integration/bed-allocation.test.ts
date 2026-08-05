import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupHostel,
  createTestHostel,
  createTestResident,
  db,
  disconnect,
  hasDatabase,
  type TestHostel,
} from "./setup";

/**
 * The rule this file exists for: **no two active residents can occupy one bed**, and that
 * must hold when two managers click "allocate" at the same instant.
 *
 * The guarantee comes from a unique index on `bed_allocation.activeBedId`, not from a
 * check in application code. An application check reads, decides, then writes, and two
 * requests can both read "vacant" before either writes. The database refuses the second
 * insert no matter how the two requests interleave.
 */
describe.skipIf(!hasDatabase)("bed allocation", () => {
  let hostel: TestHostel;

  beforeEach(async () => {
    hostel = await createTestHostel("alloc");
  });

  afterEach(async () => {
    await cleanupHostel(hostel.hostelId);
  });

  afterAll(async () => {
    await disconnect();
  });

  it("allocates a vacant bed", async () => {
    const prisma = db();
    const resident = await createTestResident(hostel.hostelId, "Ali Raza");
    const bedId = hostel.bedIds[0];

    const allocation = await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId,
        admissionId: resident.admissionId,
        residentId: resident.residentId,
        activeBedId: bedId,
      },
    });

    expect(allocation.releasedAt).toBeNull();
    expect(allocation.activeBedId).toBe(bedId);
  });

  it("refuses a second live allocation on the same bed", async () => {
    const prisma = db();
    const first = await createTestResident(hostel.hostelId, "Ali Raza");
    const second = await createTestResident(hostel.hostelId, "Hamza Khan");
    const bedId = hostel.bedIds[0];

    await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId,
        admissionId: first.admissionId,
        residentId: first.residentId,
        activeBedId: bedId,
      },
    });

    await expect(
      prisma.bedAllocation.create({
        data: {
          hostelId: hostel.hostelId,
          bedId,
          admissionId: second.admissionId,
          residentId: second.residentId,
          activeBedId: bedId,
        },
      }),
    ).rejects.toThrow();
  });

  it("resolves two concurrent claims on one bed to exactly one winner", async () => {
    const prisma = db();
    const first = await createTestResident(hostel.hostelId, "Ali Raza");
    const second = await createTestResident(hostel.hostelId, "Hamza Khan");
    const bedId = hostel.bedIds[0];

    // Both transactions read a vacant bed and both try to claim it. This is the race a
    // client-side check cannot survive.
    const claim = (admissionId: string, residentId: string) =>
      prisma.$transaction(async (tx) => {
        const bed = await tx.bed.findUniqueOrThrow({ where: { id: bedId } });
        if (bed.status !== "VACANT") throw new Error("bed is not vacant");

        await tx.bedAllocation.create({
          data: {
            hostelId: hostel.hostelId,
            bedId,
            admissionId,
            residentId,
            activeBedId: bedId,
          },
        });

        await tx.bed.update({ where: { id: bedId }, data: { status: "OCCUPIED" } });
        return residentId;
      });

    const results = await Promise.allSettled([
      claim(first.admissionId, first.residentId),
      claim(second.admissionId, second.residentId),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // And the losing transaction left nothing behind.
    const allocations = await prisma.bedAllocation.count({ where: { bedId } });
    expect(allocations).toBe(1);

    const bed = await prisma.bed.findUniqueOrThrow({ where: { id: bedId } });
    expect(bed.status).toBe("OCCUPIED");
  });

  it("frees the bed for a new resident once the allocation is released", async () => {
    const prisma = db();
    const first = await createTestResident(hostel.hostelId, "Ali Raza");
    const second = await createTestResident(hostel.hostelId, "Hamza Khan");
    const bedId = hostel.bedIds[0];

    const original = await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId,
        admissionId: first.admissionId,
        residentId: first.residentId,
        activeBedId: bedId,
      },
    });

    // Releasing clears the mirror column; the history row itself is kept.
    await prisma.bedAllocation.update({
      where: { id: original.id },
      data: { releasedAt: new Date(), activeBedId: null, releaseReason: "moved" },
    });

    const replacement = await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId,
        admissionId: second.admissionId,
        residentId: second.residentId,
        activeBedId: bedId,
      },
    });

    expect(replacement.id).not.toBe(original.id);

    // Both rows survive: the bed's history is intact.
    const history = await prisma.bedAllocation.count({ where: { bedId } });
    expect(history).toBe(2);
  });

  it("allows different beds in the same room at the same time", async () => {
    const prisma = db();
    const first = await createTestResident(hostel.hostelId, "Ali Raza");
    const second = await createTestResident(hostel.hostelId, "Hamza Khan");

    await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId: hostel.bedIds[0],
        admissionId: first.admissionId,
        residentId: first.residentId,
        activeBedId: hostel.bedIds[0],
      },
    });

    const other = await prisma.bedAllocation.create({
      data: {
        hostelId: hostel.hostelId,
        bedId: hostel.bedIds[1],
        admissionId: second.admissionId,
        residentId: second.residentId,
        activeBedId: hostel.bedIds[1],
      },
    });

    expect(other.bedId).toBe(hostel.bedIds[1]);
  });

  it("refuses a second live admission for one resident", async () => {
    const prisma = db();
    const resident = await createTestResident(hostel.hostelId, "Ali Raza");

    await expect(
      prisma.admission.create({
        data: {
          hostelId: hostel.hostelId,
          residentId: resident.residentId,
          status: "ACTIVE",
          activeResidentId: resident.residentId,
          joiningDate: new Date(),
          agreedMonthlyRentPkr: 7500,
        },
      }),
    ).rejects.toThrow();
  });
});
