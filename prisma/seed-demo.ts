/**
 * Demonstration data — development only.
 *
 * This creates fictional residents, invoices, payments, proofs and enquiries so the
 * screens have something realistic to show. Writing invented residents into a real
 * hostel's database would corrupt the owner's records, so three separate guards must all
 * pass: NODE_ENV must not be production, ALLOW_DEMO_SEED must be true, and — the one that
 * actually matters — the target hostel must hold no resident this script did not create.
 *
 * Every CNIC, phone number and payment reference here is invented. None of it belongs to a
 * real person.
 *
 *   npm run db:seed        # structure first
 *   ALLOW_DEMO_SEED=true npm run db:seed:demo
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  AdmissionStatus,
  BedStatus,
  EnquirySource,
  EnquiryStatus,
  InvoiceKind,
  InvoiceStatus,
  MembershipRole,
  Occupation,
  PaymentMethod,
  PaymentProofStatus,
  PaymentStatus,
  PoliceStatus,
  ResidentStatus,
} from "../lib/generated/prisma/enums";

if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed demo data in production.\n" +
      "These are invented residents with invented CNICs; they must never enter a real " +
      "hostel's records.",
  );
  process.exit(1);
}

if (process.env.ALLOW_DEMO_SEED !== "true") {
  console.error(
    "Set ALLOW_DEMO_SEED=true to confirm you want fictional residents in this database.",
  );
  process.exit(1);
}

/**
 * The NODE_ENV check above is necessary but nowhere near sufficient.
 *
 * `tsx prisma/seed-demo.ts` does not load `.env`, so NODE_ENV is usually undefined and
 * that guard simply does not fire. The realistic accident is a developer restoring a
 * production dump locally to reproduce a bug — a workflow this project's own
 * backup-and-restore documentation describes — and then running the demo seed to get
 * populated screens. Nothing above would stop it, and the damage is not undoable: the
 * audit rows it writes are protected by append-only triggers and ON DELETE RESTRICT.
 *
 * So the real guard is downstream, in `assertHostelIsSafeToSeed`: the target hostel must
 * contain no residents this script did not create.
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

/** Fictional people. Clearly invented CNICs and numbers. */
const RESIDENTS = [
  {
    key: "ali-raza",
    fullName: "Ali Raza",
    cnic: "3520200000011",
    phone: "03001100011",
    institution: "Punjab University",
    room: "101",
    bed: "A",
    police: PoliceStatus.VERIFIED,
    invoice: "PAID" as const,
  },
  {
    key: "hamza-khan",
    fullName: "Hamza Khan",
    cnic: "3520200000022",
    phone: "03001100022",
    institution: "UET Lahore",
    room: "101",
    bed: "B",
    police: PoliceStatus.SUBMITTED,
    invoice: "PARTIAL" as const,
  },
  {
    key: "abdullah-ahmed",
    fullName: "Abdullah Ahmed",
    cnic: "3520200000033",
    phone: "03001100033",
    institution: "FAST NUCES",
    room: "102",
    bed: "A",
    police: PoliceStatus.DOCUMENTS_INCOMPLETE,
    invoice: "OVERDUE" as const,
  },
  {
    key: "bilal-hussain",
    fullName: "Bilal Hussain",
    cnic: "3520200000044",
    phone: "03001100044",
    institution: "Government College University",
    room: "103",
    bed: "C",
    police: PoliceStatus.NOT_STARTED,
    invoice: "ISSUED" as const,
  },
  {
    key: "usman-tariq",
    fullName: "Usman Tariq",
    cnic: "3520200000055",
    phone: "03001100055",
    institution: "Systems Limited",
    room: "201",
    bed: "A",
    police: PoliceStatus.FORM_PREPARED,
    invoice: "PAID" as const,
  },
  {
    key: "saad-ali",
    fullName: "Saad Ali",
    cnic: "3520200000066",
    phone: "03001100066",
    institution: "LUMS",
    room: "202",
    bed: "B",
    police: PoliceStatus.CORRECTION_REQUIRED,
    invoice: "OVERDUE" as const,
  },
] as const;

const ENQUIRIES = [
  {
    name: "Talha Mehmood",
    phone: "03211200011",
    source: EnquirySource.WALK_IN,
    status: EnquiryStatus.NEW,
    notes: "Wants ground floor near the mess",
  },
  {
    name: "Zain Abbas",
    phone: "03211200022",
    source: EnquirySource.WHATSAPP,
    status: EnquiryStatus.VISIT_SCHEDULED,
    notes: "Visiting on Saturday",
  },
  {
    name: "Faisal Nadeem",
    phone: "03211200033",
    source: EnquirySource.REFERRAL,
    status: EnquiryStatus.VISITED,
    notes: "Referred by Ali Raza",
  },
  {
    name: "Kamran Shah",
    phone: "03211200044",
    source: EnquirySource.FACEBOOK,
    status: EnquiryStatus.BED_HELD,
    notes: "Asked to hold a four-seater bed",
  },
  {
    name: "Rehan Aslam",
    phone: "03211200055",
    source: EnquirySource.PROPERTY_LISTING,
    status: EnquiryStatus.LOST,
    notes: "Chose a hostel closer to campus",
  },
] as const;

/** The hostel operates in Pakistan; billing months are its months, not UTC's. */
const HOSTEL_TIME_ZONE = "Asia/Karachi";

/**
 * First day of the current month **in the hostel's time zone**.
 *
 * Computing this from UTC would put the first five hours of the 1st into the previous
 * month, since Pakistan is UTC+5. That is not cosmetic: `monthlyKey` is the column the
 * `@@unique([admissionId, monthlyKey])` index uses to make monthly invoicing idempotent,
 * so a seed stamped with the wrong month leaves the real generator free to raise a second
 * invoice for the month that was actually meant — double-billing the resident.
 */
function currentMonthStart(): Date {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOSTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);

  return new Date(Date.UTC(year, month - 1, 1));
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** Every CNIC this script invents shares this prefix, which no real CNIC block uses. */
const DEMO_CNIC_PREFIX = "35202000000";

/**
 * Refuses to touch a hostel that holds records this script did not create.
 *
 * This is the guard that actually matters. The environment checks at the top of the file
 * are easy to satisfy by accident — NODE_ENV is usually unset under `tsx` — whereas
 * "does this database already contain real people?" is the question whose wrong answer
 * corrupts an owner's records irreversibly.
 */
async function assertHostelIsSafeToSeed(hostelId: string, hostelName: string) {
  const foreignResident = await prisma.resident.findFirst({
    where: {
      hostelId,
      NOT: { cnicNormalized: { startsWith: DEMO_CNIC_PREFIX } },
    },
    select: { id: true },
  });

  if (foreignResident) {
    const total = await prisma.resident.count({ where: { hostelId } });
    console.error(
      `Refusing to seed demo data into "${hostelName}".\n\n` +
        `It already holds ${total} resident record(s) that this script did not create,\n` +
        "which means it is a real or restored database rather than a scratch one.\n" +
        "Fictional residents written here could not be cleanly removed afterwards: the\n" +
        "audit rows they produce are append-only and pinned by ON DELETE RESTRICT.\n\n" +
        "Use an empty database:\n" +
        "  DATABASE_URL=<scratch db> npm run db:seed\n" +
        "  DATABASE_URL=<scratch db> ALLOW_DEMO_SEED=true npm run db:seed:demo",
    );
    process.exitCode = 1;
    return false;
  }

  return true;
}

async function main() {
  const hostel = await prisma.hostel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hostel) {
    console.error("Run `npm run db:seed` first: there is no hostel to add residents to.");
    process.exitCode = 1;
    return;
  }

  if (!(await assertHostelIsSafeToSeed(hostel.id, hostel.name))) return;

  const staffUser = await prisma.hostelMembership.findFirst({
    where: {
      hostelId: hostel.id,
      role: { in: [MembershipRole.OWNER, MembershipRole.MANAGER] },
      revokedAt: null,
    },
    select: { userId: true },
  });

  const deposit = await prisma.chargeType.findUnique({
    where: { hostelId_code: { hostelId: hostel.id, code: "SECURITY_DEPOSIT" } },
  });
  const policeCharge = await prisma.chargeType.findUnique({
    where: { hostelId_code: { hostelId: hostel.id, code: "POLICE_FORM" } },
  });

  const monthStart = currentMonthStart();
  let created = 0;

  for (const person of RESIDENTS) {
    // Idempotent: an existing demo resident is left exactly as it is.
    const existing = await prisma.resident.findFirst({
      where: { hostelId: hostel.id, cnicNormalized: person.cnic },
      select: { id: true },
    });
    if (existing) continue;

    const bed = await prisma.bed.findFirst({
      where: {
        hostelId: hostel.id,
        label: person.bed,
        room: { number: person.room },
        status: BedStatus.VACANT,
      },
      include: { room: { include: { roomType: true } } },
    });

    if (!bed) {
      console.warn(
        `  skipped ${person.fullName}: room ${person.room} bed ${person.bed} is not vacant`,
      );
      continue;
    }

    const rentPkr = bed.room.roomType.monthlyRentPkr;
    const depositPkr = deposit?.defaultAmountPkr ?? 0;
    const policePkr = policeCharge?.defaultAmountPkr ?? 0;

    await prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          hostelId: hostel.id,
          fullName: person.fullName,
          cnicNormalized: person.cnic,
          activeCnicKey: person.cnic,
          phone: person.phone,
          addressLine: "House 1, Demo Street",
          city: "Lahore",
          institution: person.institution,
          occupation: Occupation.STUDENT,
          status: ResidentStatus.ACTIVE,
          guardians: {
            create: {
              fullName: `${person.fullName.split(" ")[0]} Senior`,
              relationship: "Father",
              cnicNormalized: `${person.cnic.slice(0, 12)}9`,
              phone: person.phone.replace(/^0300/, "0321"),
              isEmergencyContact: true,
            },
          },
        },
      });

      const admission = await tx.admission.create({
        data: {
          hostelId: hostel.id,
          residentId: resident.id,
          status: AdmissionStatus.ACTIVE,
          activeResidentId: resident.id,
          joiningDate: daysFromNow(-45),
          agreedMonthlyRentPkr: rentPkr,
        },
      });

      await tx.bedAllocation.create({
        data: {
          hostelId: hostel.id,
          bedId: bed.id,
          admissionId: admission.id,
          residentId: resident.id,
          activeBedId: bed.id,
          createdByUserId: staffUser?.userId ?? null,
        },
      });

      await tx.bed.update({
        where: { id: bed.id },
        data: { status: BedStatus.OCCUPIED },
      });

      // The deposit is a ledger entry, never a column on the resident.
      if (depositPkr > 0) {
        await tx.securityDepositLedger.create({
          data: {
            hostelId: hostel.id,
            residentId: resident.id,
            admissionId: admission.id,
            entryType: "RECEIVED",
            amountPkr: depositPkr,
            reason: "Received at admission",
            recordedByUserId: staffUser?.userId ?? null,
          },
        });
      }

      await tx.policeVerification.create({
        data: {
          hostelId: hostel.id,
          residentId: resident.id,
          admissionId: admission.id,
          status: person.police,
          missingDocuments:
            person.police === PoliceStatus.DOCUMENTS_INCOMPLETE
              ? "Guardian CNIC copy"
              : null,
          events: { create: { status: person.police, note: "Demo seed" } },
        },
      });

      const invoiceCount = await tx.invoice.count({ where: { hostelId: hostel.id } });
      const number = `INV-${String(invoiceCount + 1).padStart(5, "0")}`;

      const status =
        person.invoice === "PAID"
          ? InvoiceStatus.PAID
          : person.invoice === "PARTIAL"
            ? InvoiceStatus.PARTIAL
            : person.invoice === "OVERDUE"
              ? InvoiceStatus.OVERDUE
              : InvoiceStatus.ISSUED;

      const invoice = await tx.invoice.create({
        data: {
          hostelId: hostel.id,
          residentId: resident.id,
          admissionId: admission.id,
          kind: InvoiceKind.MONTHLY_RENT,
          status,
          number,
          periodMonth: monthStart,
          monthlyKey: monthStart,
          issuedAt: monthStart,
          dueDate: new Date(
            Date.UTC(
              monthStart.getUTCFullYear(),
              monthStart.getUTCMonth(),
              hostel.rentDueDay,
            ),
          ),
          totalPkr: rentPkr,
          lines: {
            create: {
              kind: "RENT",
              description: "Monthly rent",
              amountPkr: rentPkr,
            },
          },
        },
        include: { lines: true },
      });

      // Money actually received, matching the invoice status above.
      const receivedPkr =
        person.invoice === "PAID" ? rentPkr : person.invoice === "PARTIAL" ? 4000 : 0;

      if (receivedPkr > 0) {
        const payment = await tx.payment.create({
          data: {
            hostelId: hostel.id,
            residentId: resident.id,
            admissionId: admission.id,
            method: PaymentMethod.CASH,
            status: PaymentStatus.VERIFIED,
            amountPkr: receivedPkr,
            paidAt: daysFromNow(-3),
            verifiedByUserId: staffUser?.userId ?? null,
            verifiedAt: daysFromNow(-3),
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceLineId: invoice.lines[0].id,
            amountPkr: receivedPkr,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "admission.confirmed",
          entityType: "Admission",
          entityId: admission.id,
          hostelId: hostel.id,
          actorUserId: staffUser?.userId ?? null,
          summary: `Demo admission for ${person.fullName} into room ${person.room} bed ${person.bed}`,
          metadata: {
            demo: true,
            rentPkr,
            depositPkr,
            policePkr,
            totalPkr: rentPkr + depositPkr + policePkr,
          },
        },
      });
    });

    created += 1;
  }

  // Proofs waiting in the review queue.
  //
  // The claimed amount is derived from what the resident actually still owes rather than
  // hard-coded. A fixed figure produced proofs that could not be approved into a balanced
  // allocation: one resident's invoice was already fully paid, another was on a
  // three-seater rent, and a third had made a part payment.
  const proofCandidates = await prisma.resident.findMany({
    where: { hostelId: hostel.id, status: ResidentStatus.ACTIVE },
    take: 4,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      invoices: {
        where: {
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
          },
        },
        orderBy: { dueDate: "asc" },
        take: 1,
        select: {
          id: true,
          totalPkr: true,
          lines: { select: { allocations: { select: { amountPkr: true } } } },
        },
      },
    },
  });

  let proofsCreated = 0;

  for (const [index, resident] of proofCandidates.entries()) {
    if (proofsCreated >= 3) break;

    const invoice = resident.invoices[0];
    // A resident whose rent is settled has nothing to submit a proof for.
    if (!invoice) continue;

    const receivedPkr = invoice.lines
      .flatMap((line) => line.allocations)
      .reduce((total, allocation) => total + allocation.amountPkr, 0);
    const outstandingPkr = Math.max(0, invoice.totalPkr - receivedPkr);
    if (outstandingPkr === 0) continue;

    const already = await prisma.paymentProof.findFirst({
      where: { residentId: resident.id, status: PaymentProofStatus.SUBMITTED },
      select: { id: true },
    });
    if (already) continue;

    await prisma.paymentProof.create({
      data: {
        hostelId: hostel.id,
        residentId: resident.id,
        invoiceId: invoice.id,
        status: PaymentProofStatus.SUBMITTED,
        claimedAmountPkr: outstandingPkr,
        method: index === 0 ? PaymentMethod.JAZZCASH : PaymentMethod.BANK_TRANSFER,
        reference: `DEMO-REF-${1000 + index}`,
        senderName: resident.fullName,
        paidAt: daysFromNow(-1),
        events: { create: { status: PaymentProofStatus.SUBMITTED, reason: "Demo seed" } },
      },
    });
    proofsCreated += 1;
  }

  // Two residents leaving soon, so the dashboard has upcoming checkouts.
  const leaving = await prisma.admission.findMany({
    where: { hostelId: hostel.id, status: AdmissionStatus.ACTIVE },
    take: 2,
    orderBy: { createdAt: "desc" },
    select: { id: true, residentId: true },
  });

  for (const admission of leaving) {
    const existing = await prisma.checkout.findUnique({
      where: { admissionId: admission.id },
      select: { id: true },
    });
    if (existing) continue;

    // Both figures come from the ledger and the invoices, never from the charge-type
    // default. The schema's contract is that stored checkout figures are computed from
    // real rows; reading defaultAmountPkr would also mean an owner editing the deposit
    // later makes every seeded checkout claim a balance the ledger does not support.
    const depositEntries = await prisma.securityDepositLedger.findMany({
      where: { admissionId: admission.id },
      select: { amountPkr: true },
    });
    const depositHeldPkr = depositEntries.reduce(
      (total, entry) => total + entry.amountPkr,
      0,
    );

    const openInvoices = await prisma.invoice.findMany({
      where: {
        admissionId: admission.id,
        status: {
          in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
        },
      },
      select: {
        totalPkr: true,
        lines: { select: { allocations: { select: { amountPkr: true } } } },
      },
    });

    const outstandingRentPkr = openInvoices.reduce((total, invoice) => {
      const received = invoice.lines
        .flatMap((line) => line.allocations)
        .reduce((sum, allocation) => sum + allocation.amountPkr, 0);
      return total + Math.max(0, invoice.totalPkr - received);
    }, 0);

    await prisma.checkout.create({
      data: {
        hostelId: hostel.id,
        residentId: admission.residentId,
        admissionId: admission.id,
        intendedLeavingDate: daysFromNow(10),
        depositHeldPkr,
        outstandingRentPkr,
        refundablePkr: Math.max(0, depositHeldPkr - outstandingRentPkr),
      },
    });
  }

  for (const enquiry of ENQUIRIES) {
    const existing = await prisma.enquiry.findFirst({
      where: { hostelId: hostel.id, phone: enquiry.phone },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.enquiry.create({
      data: {
        hostelId: hostel.id,
        name: enquiry.name,
        phone: enquiry.phone,
        source: enquiry.source,
        status: enquiry.status,
        notes: enquiry.notes,
        expectedJoiningDate: daysFromNow(14),
        events: { create: { status: enquiry.status, note: "Demo seed" } },
      },
    });
  }

  // A couple of beds under maintenance so the room grid is not uniformly green.
  //
  // Guarded like every other block here. Without the count, each run would take two more
  // VACANT beds out of service — the ones already flipped no longer match the filter — so
  // three runs would quietly remove six beds from the hostel's capacity with no way back.
  const MAINTENANCE_TARGET = 2;
  const alreadyDown = await prisma.bed.count({
    where: { hostelId: hostel.id, status: BedStatus.MAINTENANCE },
  });

  if (alreadyDown < MAINTENANCE_TARGET) {
    const maintenanceBeds = await prisma.bed.findMany({
      where: { hostelId: hostel.id, status: BedStatus.VACANT },
      take: MAINTENANCE_TARGET - alreadyDown,
      // Ordered by id, not createdAt: beds seeded in the same run can share a millisecond,
      // which made the choice differ between environments.
      orderBy: { id: "asc" },
      select: { id: true },
    });

    for (const bed of maintenanceBeds) {
      await prisma.bed.update({
        where: { id: bed.id },
        data: { status: BedStatus.MAINTENANCE },
      });
    }
  }

  const counts = {
    residents: await prisma.resident.count({ where: { hostelId: hostel.id } }),
    invoices: await prisma.invoice.count({ where: { hostelId: hostel.id } }),
    proofs: await prisma.paymentProof.count({
      where: { hostelId: hostel.id, status: PaymentProofStatus.SUBMITTED },
    }),
    enquiries: await prisma.enquiry.count({ where: { hostelId: hostel.id } }),
    occupied: await prisma.bed.count({
      where: { hostelId: hostel.id, status: BedStatus.OCCUPIED },
    }),
  };

  console.log(`Demo seed complete (${created} residents created in this run).`);
  console.log(`  residents ${counts.residents}`);
  console.log(`  occupied beds ${counts.occupied}`);
  console.log(`  invoices ${counts.invoices}`);
  console.log(`  proofs awaiting review ${counts.proofs}`);
  console.log(`  enquiries ${counts.enquiries}`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
