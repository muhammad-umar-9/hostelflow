import "server-only";

import { z } from "zod";
import {
  AdmissionStatus,
  BedStatus,
  ChargeKind,
  DepositEntryType,
  InvoiceKind,
  InvoiceStatus,
  Occupation,
  PaymentMethod,
  PaymentStatus,
  PoliceStatus,
  ReceiptKind,
  ResidentStatus,
} from "@/lib/generated/prisma/enums";
import { calculateAdmissionCharges } from "@/lib/domain/charges";
import { normalizeCnic, normalizeMobile } from "@/lib/domain/identity";
import { assertPositivePkr } from "@/lib/domain/money";
import { optionalRequestContext, recordAudit } from "./audit";
import { NotFoundError, requirePermission, type AuthContext } from "./authz";
import { prisma, type TransactionClient } from "./db";

/**
 * Admitting a resident: the first workflow that writes real money.
 *
 * One database transaction creates the resident, their guardian, the admission, the bed
 * allocation, the charge invoice, the payment, the deposit ledger entry, the police
 * verification record and the receipt — and flips the bed to OCCUPIED. Either all of that
 * happens or none of it does. A half-admitted resident holding a bed with no invoice is
 * not a state anyone can reason about afterwards.
 *
 * Two rules the rest of this file exists to serve:
 *
 *   * **Every amount is computed here, from configuration.** The client sends what was
 *     collected, never what is owed. A total that arrives from a browser is a total an
 *     attacker chose.
 *   * **The bed is claimed by the database, not by a check.** The unique index on
 *     `bed_allocation.activeBedId` decides who wins a race; this code only has to handle
 *     losing gracefully.
 */

/** Raised when the bed was taken between the manager choosing it and confirming. */
export class BedUnavailableError extends Error {
  readonly status = 409;
  constructor(message = "That bed has just been taken. Choose another.") {
    super(message);
    this.name = "BedUnavailableError";
  }
}

/** Raised when the resident is already admitted, or the CNIC is already active here. */
export class DuplicateResidentError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "DuplicateResidentError";
  }
}

export const admitResidentSchema = z.object({
  bedId: z.string().min(1, "Choose a bed"),
  joiningDate: z.coerce.date(),

  resident: z.object({
    fullName: z.string().trim().min(3, "Enter the full name"),
    cnic: z.string().min(1, "CNIC is required"),
    phone: z.string().min(1, "Mobile number is required"),
    dateOfBirth: z.coerce.date().optional(),
    addressLine: z.string().trim().min(6, "Permanent address is required"),
    city: z.string().trim().min(2, "City is required"),
    institution: z.string().trim().optional(),
    occupation: z.nativeEnum(Occupation).default(Occupation.STUDENT),
  }),

  guardian: z.object({
    fullName: z.string().trim().min(3, "Guardian name is required"),
    relationship: z.string().trim().min(2, "Relationship is required"),
    cnic: z.string().optional(),
    phone: z.string().min(1, "Guardian mobile is required"),
  }),

  /** What the manager actually collected now. Never the amount owed. */
  payment: z.object({
    method: z.nativeEnum(PaymentMethod),
    amountPkr: z.number().int().positive("Enter the amount received"),
    reference: z.string().trim().optional(),
    paidAt: z.coerce.date().default(() => new Date()),
  }),

  /** Ids of documents already uploaded through /api/uploads. */
  documentIds: z.array(z.string()).default([]),
});

export type AdmitResidentInput = z.infer<typeof admitResidentSchema>;

export interface AdmitResidentResult {
  residentId: string;
  admissionId: string;
  invoiceId: string;
  paymentId: string;
  receiptId: string;
  receiptNumber: string;
  totalPkr: number;
  receivedPkr: number;
  balancePkr: number;
}

/**
 * Takes the next document number for a hostel.
 *
 * `UPDATE ... RETURNING` inside the caller's transaction, so the row lock serializes
 * concurrent admissions rather than letting both compute the same number and one die on
 * the unique index.
 */
async function nextNumber(
  tx: TransactionClient,
  hostelId: string,
  kind: "invoice" | "receipt",
): Promise<string> {
  const column = kind === "invoice" ? "invoiceSequence" : "receiptSequence";
  const rows = await tx.$queryRawUnsafe<{ value: number }[]>(
    `UPDATE "hostel" SET "${column}" = "${column}" + 1 WHERE "id" = $1 RETURNING "${column}" AS "value"`,
    hostelId,
  );

  const value = rows[0]?.value;
  if (value === undefined) throw new NotFoundError();

  const prefix = kind === "invoice" ? "INV" : "RCP";
  return `${prefix}-${String(value).padStart(5, "0")}`;
}

/** Postgres reports a unique-index conflict as P2002 through Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/**
 * Admits a resident into a specific bed and records the payment taken at the desk.
 *
 * For the pilot's four-seater this produces rent 7,500 + deposit 3,000 + police form 300
 * = 10,800, all read from the hostel's configuration rather than written down here.
 */
export async function admitResident(
  input: AdmitResidentInput,
  context?: AuthContext,
): Promise<AdmitResidentResult> {
  const parsed = admitResidentSchema.parse(input);
  const { user, membership } = context ?? (await requirePermission("beds.allocate"));

  // Normalized before the transaction so a malformed CNIC fails fast and cheaply.
  const cnicNormalized = normalizeCnic(parsed.resident.cnic);
  const phone = normalizeMobile(parsed.resident.phone);
  const guardianPhone = normalizeMobile(parsed.guardian.phone);
  const guardianCnic = parsed.guardian.cnic ? normalizeCnic(parsed.guardian.cnic) : null;
  assertPositivePkr(parsed.payment.amountPkr, "payment");

  // optionalRequestContext, not requestContext: this transaction must be callable from
  // a script, a scheduled job or a test, none of which have an HTTP request scope. The
  // client address is recorded when there is one and omitted when there is not.
  const requestMeta = await optionalRequestContext();

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. The bed, scoped to this hostel, with the room type that sets the rent.
      const bed = await tx.bed.findFirst({
        where: { id: parsed.bedId, hostelId: membership.hostelId },
        include: { room: { include: { roomType: true } } },
      });
      if (!bed) throw new NotFoundError();
      if (bed.status !== BedStatus.VACANT) throw new BedUnavailableError();

      // 2. Charges from configuration. Nothing here comes from the client.
      const charges = await tx.chargeType.findMany({
        where: { hostelId: membership.hostelId, active: true },
      });
      const amountFor = (kind: ChargeKind) =>
        charges.find((charge) => charge.kind === kind && charge.oneTime)
          ?.defaultAmountPkr ?? 0;

      const breakdown = calculateAdmissionCharges({
        monthlyRentPkr: bed.room.roomType.monthlyRentPkr,
        securityDepositPkr: amountFor(ChargeKind.SECURITY_DEPOSIT),
        policeFormPkr: amountFor(ChargeKind.POLICE_FORM),
      });

      // 3. Resident. activeCnicKey mirrors the CNIC so the database refuses a second
      //    active resident with the same identity number in this hostel.
      const resident = await tx.resident.create({
        data: {
          hostelId: membership.hostelId,
          fullName: parsed.resident.fullName,
          cnicNormalized,
          activeCnicKey: cnicNormalized,
          dateOfBirth: parsed.resident.dateOfBirth ?? null,
          phone,
          addressLine: parsed.resident.addressLine,
          city: parsed.resident.city,
          institution: parsed.resident.institution || null,
          occupation: parsed.resident.occupation,
          status: ResidentStatus.ACTIVE,
          guardians: {
            create: {
              fullName: parsed.guardian.fullName,
              relationship: parsed.guardian.relationship,
              cnicNormalized: guardianCnic,
              phone: guardianPhone,
              isEmergencyContact: true,
            },
          },
        },
      });

      // 4. Admission, with the rent agreed today frozen onto it.
      const admission = await tx.admission.create({
        data: {
          hostelId: membership.hostelId,
          residentId: resident.id,
          status: AdmissionStatus.ACTIVE,
          activeResidentId: resident.id,
          joiningDate: parsed.joiningDate,
          agreedMonthlyRentPkr: bed.room.roomType.monthlyRentPkr,
        },
      });

      // 5. The bed claim. This insert is the race: activeBedId is unique, so a second
      //    concurrent admission for the same bed fails here rather than double-booking.
      await tx.bedAllocation.create({
        data: {
          hostelId: membership.hostelId,
          bedId: bed.id,
          admissionId: admission.id,
          residentId: resident.id,
          activeBedId: bed.id,
          createdByUserId: user.id,
        },
      });

      await tx.bed.update({
        where: { id: bed.id },
        data: { status: BedStatus.OCCUPIED },
      });

      // 6. Invoice for the admission charges.
      const invoice = await tx.invoice.create({
        data: {
          hostelId: membership.hostelId,
          residentId: resident.id,
          admissionId: admission.id,
          kind: InvoiceKind.ADMISSION,
          status: InvoiceStatus.ISSUED,
          number: await nextNumber(tx, membership.hostelId, "invoice"),
          issuedAt: new Date(),
          dueDate: parsed.joiningDate,
          totalPkr: breakdown.totalPkr,
          lines: {
            create: breakdown.lines.map((line) => ({
              kind: line.kind as ChargeKind,
              description: line.label,
              amountPkr: line.amountPkr,
              chargeTypeId:
                charges.find((charge) => charge.kind === (line.kind as ChargeKind))?.id ??
                null,
            })),
          },
        },
        include: { lines: true },
      });

      // 7. The payment, and how it splits across the invoice lines. Allocating in line
      //    order means a short payment settles rent first and leaves the deposit
      //    outstanding, which is the order the hostel actually cares about.
      const payment = await tx.payment.create({
        data: {
          hostelId: membership.hostelId,
          residentId: resident.id,
          admissionId: admission.id,
          method: parsed.payment.method,
          status: PaymentStatus.VERIFIED,
          amountPkr: parsed.payment.amountPkr,
          reference: parsed.payment.reference || null,
          paidAt: parsed.payment.paidAt,
          verifiedByUserId: user.id,
          verifiedAt: new Date(),
        },
      });

      let remaining = parsed.payment.amountPkr;
      let depositReceivedPkr = 0;

      for (const line of invoice.lines) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, line.amountPkr);

        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, invoiceLineId: line.id, amountPkr: applied },
        });
        remaining -= applied;

        if (line.kind === ChargeKind.SECURITY_DEPOSIT) depositReceivedPkr = applied;
      }

      const receivedPkr = parsed.payment.amountPkr - remaining;
      const balancePkr = Math.max(0, breakdown.totalPkr - receivedPkr);

      if (balancePkr === 0) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID },
        });
      } else if (receivedPkr > 0) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PARTIAL },
        });
      }

      // 8. The deposit is a ledger entry, never a column. Only what was actually
      //    collected towards it is recorded.
      if (depositReceivedPkr > 0) {
        await tx.securityDepositLedger.create({
          data: {
            hostelId: membership.hostelId,
            residentId: resident.id,
            admissionId: admission.id,
            entryType: DepositEntryType.RECEIVED,
            amountPkr: depositReceivedPkr,
            reason: "Received at admission",
            recordedByUserId: user.id,
          },
        });
      }

      // 9. Police verification starts its own track. Paying the form charge does not
      //    make anybody verified.
      await tx.policeVerification.create({
        data: {
          hostelId: membership.hostelId,
          residentId: resident.id,
          admissionId: admission.id,
          status: PoliceStatus.NOT_STARTED,
          updatedByUserId: user.id,
          events: { create: { status: PoliceStatus.NOT_STARTED, actorUserId: user.id } },
        },
      });

      // 10. Attach the documents uploaded earlier, scoped to this hostel so an id from
      //     elsewhere cannot be smuggled onto a resident's file.
      if (parsed.documentIds.length > 0) {
        const objects = await tx.storedObject.findMany({
          where: {
            id: { in: parsed.documentIds },
            hostelId: membership.hostelId,
            deletedAt: null,
          },
          select: { id: true, kind: true },
        });

        for (const object of objects) {
          await tx.residentDocument.create({
            data: { residentId: resident.id, objectId: object.id, kind: object.kind },
          });
        }
      }

      // 11. The receipt, built from what was just written rather than from the request.
      const receipt = await tx.receipt.create({
        data: {
          hostelId: membership.hostelId,
          residentId: resident.id,
          admissionId: admission.id,
          paymentId: payment.id,
          kind: ReceiptKind.ADMISSION,
          number: await nextNumber(tx, membership.hostelId, "receipt"),
          totalReceivedPkr: receivedPkr,
          balancePkr,
          issuedByUserId: user.id,
          snapshot: {
            residentName: resident.fullName,
            room: bed.room.number,
            bed: bed.label,
            roomType: bed.room.roomType.name,
            joiningDate: parsed.joiningDate.toISOString(),
            lines: breakdown.lines.map((line) => ({
              description: line.label,
              amountPkr: line.amountPkr,
            })),
            totalPkr: breakdown.totalPkr,
            receivedPkr,
            balancePkr,
            method: parsed.payment.method,
          },
        },
      });

      await recordAudit(
        {
          action: "admission.confirmed",
          entityType: "Admission",
          entityId: admission.id,
          hostelId: membership.hostelId,
          actorUserId: user.id,
          summary: `Admitted ${resident.fullName} into room ${bed.room.number} bed ${bed.label}`,
          metadata: {
            totalPkr: breakdown.totalPkr,
            receivedPkr,
            balancePkr,
            room: bed.room.number,
            bed: bed.label,
          },
          ...requestMeta,
        },
        tx,
      );

      return {
        residentId: resident.id,
        admissionId: admission.id,
        invoiceId: invoice.id,
        paymentId: payment.id,
        receiptId: receipt.id,
        receiptNumber: receipt.number,
        totalPkr: breakdown.totalPkr,
        receivedPkr,
        balancePkr,
      };
    });
  } catch (error) {
    // A unique violation here is one of the guarantees doing its job. Translating it
    // gives the manager something actionable instead of a database error.
    //
    // Which guarantee fired has to be established by asking the database, not by reading
    // the error. Prisma's driver adapter does not populate `meta.target` — it reports
    // "Unique constraint failed on the (not available)" — so matching on the index name
    // silently never fired, and the raw fault reached the caller.
    //
    // The transaction has rolled back by this point, so these reads see only rows that
    // committed elsewhere: exactly the conflicting ones.
    if (isUniqueViolation(error)) {
      const [bedTaken, cnicActive, admissionLive] = await Promise.all([
        prisma.bedAllocation.findFirst({
          where: { activeBedId: parsed.bedId },
          select: { id: true },
        }),
        prisma.resident.findFirst({
          where: { hostelId: membership.hostelId, activeCnicKey: cnicNormalized },
          select: { id: true },
        }),
        prisma.admission.findFirst({
          where: {
            hostelId: membership.hostelId,
            resident: { cnicNormalized },
            activeResidentId: { not: null },
          },
          select: { id: true },
        }),
      ]);

      // Bed first: in a race it is both the likeliest cause and the more actionable
      // message, since choosing another bed is something the manager can do right now.
      if (bedTaken) throw new BedUnavailableError();
      if (cnicActive) {
        throw new DuplicateResidentError(
          "Somebody with this CNIC is already living here.",
        );
      }
      if (admissionLive) {
        throw new DuplicateResidentError("This resident already has a live admission.");
      }
    }
    throw error;
  }
}
