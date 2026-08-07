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
 * The remaining database-level guarantees: invoice idempotency, unique active CNIC, tenant
 * isolation, and an audit trail that genuinely cannot be rewritten.
 */
describe.skipIf(!hasDatabase)("database integrity", () => {
  let hostel: TestHostel;

  beforeEach(async () => {
    hostel = await createTestHostel("integrity");
  });

  afterEach(async () => {
    await cleanupHostel(hostel.hostelId);
  });

  afterAll(async () => {
    await disconnect();
  });

  describe("monthly invoice idempotency", () => {
    it("refuses a second invoice for the same admission and month", async () => {
      const prisma = db();
      const resident = await createTestResident(hostel.hostelId);
      const month = new Date(Date.UTC(2026, 7, 1));

      const invoiceData = (number: string) => ({
        hostelId: hostel.hostelId,
        residentId: resident.residentId,
        admissionId: resident.admissionId,
        kind: "MONTHLY_RENT" as const,
        number,
        periodMonth: month,
        monthlyKey: "2026-08",
        dueDate: new Date(Date.UTC(2026, 7, 5)),
        totalPkr: 7500,
      });

      await prisma.invoice.create({ data: invoiceData("INV-00001") });

      // Rerunning the monthly job must not produce a duplicate.
      await expect(
        prisma.invoice.create({ data: invoiceData("INV-00002") }),
      ).rejects.toThrow();

      const count = await prisma.invoice.count({
        where: { admissionId: resident.admissionId },
      });
      expect(count).toBe(1);
    });

    it("allows a different month for the same admission", async () => {
      const prisma = db();
      const resident = await createTestResident(hostel.hostelId);

      for (const [index, monthKey] of ["2026-08", "2026-09"].entries()) {
        const month = new Date(Date.UTC(2026, 7 + index, 1));
        await prisma.invoice.create({
          data: {
            hostelId: hostel.hostelId,
            residentId: resident.residentId,
            admissionId: resident.admissionId,
            kind: "MONTHLY_RENT",
            number: `INV-1000${index}`,
            periodMonth: month,
            monthlyKey: monthKey,
            dueDate: month,
            totalPkr: 7500,
          },
        });
      }

      const count = await prisma.invoice.count({
        where: { admissionId: resident.admissionId },
      });
      expect(count).toBe(2);
    });

    it("allows several non-monthly invoices, which carry no monthly key", async () => {
      const prisma = db();
      const resident = await createTestResident(hostel.hostelId);

      for (const number of ["ADM-1", "ADM-2"]) {
        await prisma.invoice.create({
          data: {
            hostelId: hostel.hostelId,
            residentId: resident.residentId,
            admissionId: resident.admissionId,
            kind: "ADMISSION",
            number,
            dueDate: new Date(),
            totalPkr: 10_800,
          },
        });
      }

      const count = await prisma.invoice.count({
        where: { admissionId: resident.admissionId },
      });
      expect(count).toBe(2);
    });
  });

  describe("active CNIC uniqueness", () => {
    it("refuses a second active resident with the same CNIC in one hostel", async () => {
      const prisma = db();
      const cnic = "3520299999991";

      const base = {
        hostelId: hostel.hostelId,
        cnicNormalized: cnic,
        activeCnicKey: cnic,
        phone: "03001234567",
        addressLine: "1 Test Street",
        city: "Lahore",
      };

      await prisma.resident.create({ data: { ...base, fullName: "Ali Raza" } });

      await expect(
        prisma.resident.create({ data: { ...base, fullName: "Someone Else" } }),
      ).rejects.toThrow();
    });

    it("allows re-admitting the same person after they become a former resident", async () => {
      const prisma = db();
      const cnic = "3520299999992";

      const original = await prisma.resident.create({
        data: {
          hostelId: hostel.hostelId,
          fullName: "Ali Raza",
          cnicNormalized: cnic,
          activeCnicKey: cnic,
          phone: "03001234567",
          addressLine: "1 Test Street",
          city: "Lahore",
        },
      });

      // Checking out clears the mirror column but keeps the CNIC on the history row.
      await prisma.resident.update({
        where: { id: original.id },
        data: { status: "FORMER", activeCnicKey: null },
      });

      const returning = await prisma.resident.create({
        data: {
          hostelId: hostel.hostelId,
          fullName: "Ali Raza",
          cnicNormalized: cnic,
          activeCnicKey: cnic,
          phone: "03001234567",
          addressLine: "1 Test Street",
          city: "Lahore",
        },
      });

      expect(returning.id).not.toBe(original.id);

      // History is preserved, not overwritten.
      const both = await prisma.resident.count({
        where: { hostelId: hostel.hostelId, cnicNormalized: cnic },
      });
      expect(both).toBe(2);
    });

    it("allows the same CNIC to be active in a different hostel", async () => {
      const prisma = db();
      const other = await createTestHostel("integrity-other");
      const cnic = "3520299999993";

      try {
        for (const hostelId of [hostel.hostelId, other.hostelId]) {
          await prisma.resident.create({
            data: {
              hostelId,
              fullName: "Ali Raza",
              cnicNormalized: cnic,
              activeCnicKey: cnic,
              phone: "03001234567",
              addressLine: "1 Test Street",
              city: "Lahore",
            },
          });
        }

        const count = await prisma.resident.count({ where: { cnicNormalized: cnic } });
        expect(count).toBe(2);
      } finally {
        await cleanupHostel(other.hostelId);
      }
    });
  });

  describe("tenant isolation", () => {
    it("finds nothing when a record is queried with the wrong hostel id", async () => {
      const prisma = db();
      const other = await createTestHostel("integrity-tenant");

      try {
        const resident = await createTestResident(hostel.hostelId, "Ali Raza");

        // Exactly the shape every authorized query uses: id plus hostel scope.
        const asOtherTenant = await prisma.resident.findFirst({
          where: { id: resident.residentId, hostelId: other.hostelId },
        });
        expect(asOtherTenant).toBeNull();

        const asOwnTenant = await prisma.resident.findFirst({
          where: { id: resident.residentId, hostelId: hostel.hostelId },
        });
        expect(asOwnTenant).not.toBeNull();
      } finally {
        await cleanupHostel(other.hostelId);
      }
    });

    it("keeps bed inventory separate between hostels", async () => {
      const prisma = db();
      const other = await createTestHostel("integrity-beds");

      try {
        const mine = await prisma.bed.count({ where: { hostelId: hostel.hostelId } });
        const theirs = await prisma.bed.count({ where: { hostelId: other.hostelId } });

        expect(mine).toBe(4);
        expect(theirs).toBe(4);

        const crossTenant = await prisma.bed.findFirst({
          where: { id: hostel.bedIds[0], hostelId: other.hostelId },
        });
        expect(crossTenant).toBeNull();
      } finally {
        await cleanupHostel(other.hostelId);
      }
    });
  });

  describe("the audit trail is append-only", () => {
    it("accepts an insert", async () => {
      const prisma = db();

      const entry = await prisma.auditLog.create({
        data: {
          action: "payment.verified",
          entityType: "Payment",
          entityId: "test-payment",
          hostelId: hostel.hostelId,
          summary: "Verified Rs 10,800",
        },
      });

      expect(entry.id).toBeTruthy();
    });

    it("refuses an update, even from the application's own role", async () => {
      const prisma = db();

      const entry = await prisma.auditLog.create({
        data: {
          action: "payment.verified",
          entityType: "Payment",
          hostelId: hostel.hostelId,
          summary: "Original entry",
        },
      });

      await expect(
        prisma.auditLog.update({
          where: { id: entry.id },
          data: { summary: "Rewritten history" },
        }),
      ).rejects.toThrow(/append-only/i);

      const unchanged = await prisma.auditLog.findUniqueOrThrow({
        where: { id: entry.id },
      });
      expect(unchanged.summary).toBe("Original entry");
    });

    it("refuses a delete", async () => {
      const prisma = db();

      const entry = await prisma.auditLog.create({
        data: {
          action: "payment.reversed",
          entityType: "Payment",
          hostelId: hostel.hostelId,
          summary: "Entry that someone would rather remove",
        },
      });

      await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(
        /append-only/i,
      );

      const stillThere = await prisma.auditLog.findUnique({ where: { id: entry.id } });
      expect(stillThere).not.toBeNull();
    });

    it("refuses TRUNCATE, which row-level triggers do not see", async () => {
      const prisma = db();

      await prisma.auditLog.create({
        data: {
          action: "payment.verified",
          entityType: "Payment",
          hostelId: hostel.hostelId,
          summary: "An entry someone would rather remove wholesale",
        },
      });

      // The whole append-only guarantee rested on BEFORE UPDATE/DELETE row triggers, and
      // TRUNCATE fires neither. One statement emptied the trail while the guarantee
      // looked intact.
      await expect(
        prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_log" CASCADE'),
      ).rejects.toThrow(/append-only/i);

      const survived = await prisma.auditLog.count({
        where: { hostelId: hostel.hostelId },
      });
      expect(survived).toBeGreaterThan(0);
    });

    it("refuses to delete a user who has audit history", async () => {
      const prisma = db();

      const user = await prisma.user.create({
        data: {
          name: "Manager Under Test",
          email: `manager-${Date.now()}@example.test`,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "payment.verified",
          entityType: "Payment",
          hostelId: hostel.hostelId,
          actorUserId: user.id,
          summary: "Verified a payment",
        },
      });

      // ON DELETE RESTRICT: staff who leave are disabled, never deleted, so the trail
      // keeps naming who did what.
      await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();

      await prisma.user.update({
        where: { id: user.id },
        data: { disabledAt: new Date() },
      });

      const disabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(disabled.disabledAt).not.toBeNull();
    });
  });

  describe("transactions", () => {
    it("rolls the whole admission back when any step fails", async () => {
      const prisma = db();
      const resident = await createTestResident(hostel.hostelId, "Ali Raza");
      const bedId = hostel.bedIds[0];

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.bedAllocation.create({
            data: {
              hostelId: hostel.hostelId,
              bedId,
              admissionId: resident.admissionId,
              residentId: resident.residentId,
              activeBedId: bedId,
            },
          });

          await tx.bed.update({ where: { id: bedId }, data: { status: "OCCUPIED" } });

          // Whatever fails last — a duplicate invoice number here — must undo the rest.
          await tx.invoice.create({
            data: {
              hostelId: hostel.hostelId,
              residentId: resident.residentId,
              admissionId: resident.admissionId,
              kind: "ADMISSION",
              number: "DUPLICATE",
              dueDate: new Date(),
              totalPkr: 10_800,
            },
          });
          await tx.invoice.create({
            data: {
              hostelId: hostel.hostelId,
              residentId: resident.residentId,
              admissionId: resident.admissionId,
              kind: "ADMISSION",
              number: "DUPLICATE",
              dueDate: new Date(),
              totalPkr: 10_800,
            },
          });
        }),
      ).rejects.toThrow();

      // No allocation, no invoice, and the bed is still vacant.
      expect(await prisma.bedAllocation.count({ where: { bedId } })).toBe(0);
      expect(
        await prisma.invoice.count({ where: { admissionId: resident.admissionId } }),
      ).toBe(0);

      const bed = await prisma.bed.findUniqueOrThrow({ where: { id: bedId } });
      expect(bed.status).toBe("VACANT");
    });
  });
});
