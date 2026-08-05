/**
 * Structural seed — safe to run in production.
 *
 * This creates the hostel itself: floors, room types, 36 rooms, their beds, and the
 * configurable charges. It creates no people, no money and no documents.
 *
 * Idempotent by design. Every write is an upsert keyed on a natural unique constraint, so
 * running it twice changes nothing and running it after a schema change fills in only what
 * is missing. The deployment entrypoint is allowed to call it on every boot.
 *
 * Fictional demo residents, invoices and proofs live in seed-demo.ts, which refuses to run
 * in production. Seeding fake residents into a real hostel's database would be wrong.
 *
 *   npm run db:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { ChargeKind } from "../lib/generated/prisma/enums";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Seeding needs a database to talk to.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

/**
 * The pilot's configuration. Everything here is editable in settings afterwards; these
 * are starting values, not business rules baked into the code.
 */
const PILOT = {
  slug: "hk-boys-hostel",
  name: "H-K Boys Hostel",
  addressLine: "Plot 12, Street 4, Johar Town",
  city: "Lahore",
  rentDueDay: 5,
  bedHoldHours: 48,
  depositDeductionApprovalLimitPkr: 1000,
  receiptFooter: "Thank you. Please keep this receipt for your records.",

  roomTypes: [
    { code: "THREE_SEATER", name: "Three-seater", capacity: 3, monthlyRentPkr: 9000 },
    { code: "FOUR_SEATER", name: "Four-seater", capacity: 4, monthlyRentPkr: 7500 },
  ],

  charges: [
    {
      code: "SECURITY_DEPOSIT",
      label: "Refundable security deposit",
      kind: ChargeKind.SECURITY_DEPOSIT,
      defaultAmountPkr: 3000,
      oneTime: true,
    },
    {
      code: "POLICE_FORM",
      label: "Police form charge (one time)",
      kind: ChargeKind.POLICE_FORM,
      defaultAmountPkr: 300,
      oneTime: true,
    },
    {
      code: "MONTHLY_RENT",
      label: "Monthly rent",
      kind: ChargeKind.RENT,
      // Null: rent comes from the room type, not from a single fixed amount.
      defaultAmountPkr: null,
      oneTime: false,
    },
  ],

  floors: [
    { level: 0, name: "Ground floor" },
    { level: 1, name: "First floor" },
    { level: 2, name: "Second floor" },
  ],
} as const;

const BED_LABELS = ["A", "B", "C", "D"] as const;

/**
 * 36 rooms across three floors, 12 per floor, alternating room type so each floor has a
 * mix: 18 three-seaters and 18 four-seaters, 126 beds in total
 * (18 x 3 = 54, 18 x 4 = 72).
 */
function roomPlan(): { number: string; level: number; typeCode: string }[] {
  const rooms: { number: string; level: number; typeCode: string }[] = [];

  for (const floor of PILOT.floors) {
    for (let index = 0; index < 12; index += 1) {
      const number = `${floor.level + 1}${String(index + 1).padStart(2, "0")}`;
      rooms.push({
        number,
        level: floor.level,
        typeCode: index % 2 === 0 ? "FOUR_SEATER" : "THREE_SEATER",
      });
    }
  }

  return rooms;
}

async function main() {
  console.log(`Seeding structure for ${PILOT.name}...`);

  const hostel = await prisma.hostel.upsert({
    where: { slug: PILOT.slug },
    // Only fields that describe identity are updated. Rent, deposit and the due day are
    // left alone once set, so re-running the seed never reverts an owner's settings.
    update: { name: PILOT.name, addressLine: PILOT.addressLine, city: PILOT.city },
    create: {
      slug: PILOT.slug,
      name: PILOT.name,
      addressLine: PILOT.addressLine,
      city: PILOT.city,
      rentDueDay: PILOT.rentDueDay,
      bedHoldHours: PILOT.bedHoldHours,
      depositDeductionApprovalLimitPkr: PILOT.depositDeductionApprovalLimitPkr,
      receiptFooter: PILOT.receiptFooter,
    },
  });

  for (const floor of PILOT.floors) {
    await prisma.floor.upsert({
      where: { hostelId_level: { hostelId: hostel.id, level: floor.level } },
      update: { name: floor.name },
      create: { hostelId: hostel.id, level: floor.level, name: floor.name },
    });
  }

  for (const type of PILOT.roomTypes) {
    await prisma.roomType.upsert({
      where: { hostelId_code: { hostelId: hostel.id, code: type.code } },
      // Rent is not updated: an owner who changed the price should keep their change.
      update: { name: type.name, capacity: type.capacity },
      create: {
        hostelId: hostel.id,
        code: type.code,
        name: type.name,
        capacity: type.capacity,
        monthlyRentPkr: type.monthlyRentPkr,
      },
    });
  }

  for (const charge of PILOT.charges) {
    await prisma.chargeType.upsert({
      where: { hostelId_code: { hostelId: hostel.id, code: charge.code } },
      update: { label: charge.label, kind: charge.kind },
      create: {
        hostelId: hostel.id,
        code: charge.code,
        label: charge.label,
        kind: charge.kind,
        defaultAmountPkr: charge.defaultAmountPkr,
        oneTime: charge.oneTime,
      },
    });
  }

  const floors = new Map(
    (await prisma.floor.findMany({ where: { hostelId: hostel.id } })).map((floor) => [
      floor.level,
      floor.id,
    ]),
  );
  const types = new Map(
    (await prisma.roomType.findMany({ where: { hostelId: hostel.id } })).map((type) => [
      type.code,
      type,
    ]),
  );

  let roomsCreated = 0;
  let bedsCreated = 0;

  for (const plan of roomPlan()) {
    const floorId = floors.get(plan.level);
    const roomType = types.get(plan.typeCode);
    if (!floorId || !roomType)
      throw new Error(`Missing floor or type for ${plan.number}`);

    const room = await prisma.room.upsert({
      where: { hostelId_number: { hostelId: hostel.id, number: plan.number } },
      update: { floorId, roomTypeId: roomType.id },
      create: {
        hostelId: hostel.id,
        floorId,
        roomTypeId: roomType.id,
        number: plan.number,
      },
    });
    roomsCreated += 1;

    // Room capacity must equal the number of active beds, so bed count follows the type.
    for (const label of BED_LABELS.slice(0, roomType.capacity)) {
      const existing = await prisma.bed.findUnique({
        where: { roomId_label: { roomId: room.id, label } },
        select: { id: true },
      });

      if (!existing) {
        // Only ever creates. A bed that already exists may be OCCUPIED, and resetting its
        // status would detach a real resident from their allocation.
        await prisma.bed.create({
          data: { hostelId: hostel.id, roomId: room.id, label },
        });
        bedsCreated += 1;
      }
    }
  }

  const bedTotal = await prisma.bed.count({ where: { hostelId: hostel.id } });

  console.log(`  hostel      ${hostel.name} (${hostel.slug})`);
  console.log(`  rooms       ${roomsCreated} present`);
  console.log(`  beds        ${bedTotal} present (${bedsCreated} created in this run)`);
  console.log(`  room types  ${types.size}`);
  console.log("Structural seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
