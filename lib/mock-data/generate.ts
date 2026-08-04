import { CURRENT_MONTH, FLOORS, RENT_DUE_DATE } from "@/lib/constants";
import { initialsOf } from "@/lib/formatters";
import type {
  Bed,
  HostelData,
  Invoice,
  PaymentProof,
  PoliceStage,
  Resident,
  Room,
} from "@/lib/types";
import {
  AVATAR_COLORS,
  FIRST_NAMES,
  INSTITUTIONS,
  LAHORE_AREAS,
  LAST_NAMES,
} from "./people";

/**
 * Deterministic pseudo-random generator so every reload of the demo shows the
 * same hostel. Replace this whole module with API calls in production.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FIXED_ROOMS = ["101", "102", "103", "201"];

export function generateHostelData(): HostelData {
  const random = createRandom(20260804);
  const rooms: Room[] = [];

  FLOORS.forEach((floor, floorIndex) => {
    for (let i = 1; i <= 9; i += 1) {
      const type: 3 | 4 = (floorIndex * 9 + i) % 2 === 1 ? 4 : 3;
      const beds: Bed[] = ["A", "B", "C", "D"]
        .slice(0, type)
        .map((id) => ({ id, state: "occupied" as const, residentId: null }));
      rooms.push({
        no: String(floor.base + i),
        floor: floor.name,
        floorKey: floor.key,
        type,
        rent: type === 4 ? 7500 : 9000,
        beds,
      });
    }
  });

  const roomByNo = (no: string) => rooms.find((room) => room.no === no) as Room;
  const vacate = (no: string, bedIds: string[]) => {
    bedIds.forEach((bedId) => {
      const bed = roomByNo(no).beds.find((item) => item.id === bedId);
      if (bed) bed.state = "vacant";
    });
  };

  // Scenario beds used by the demo journeys.
  vacate("101", ["D"]);
  vacate("103", ["C", "D"]);
  vacate("201", ["B", "C"]);

  let remaining = 25 - 5;
  for (let i = 0; i < rooms.length && remaining > 0; i += 1) {
    const room = rooms[i];
    if (FIXED_ROOMS.includes(room.no)) continue;
    const roll = random();
    if (roll < 0.62) {
      const count = roll < 0.16 && remaining > 1 ? 2 : 1;
      for (let j = 0; j < count; j += 1) {
        const bed = room.beds[room.beds.length - 1 - j];
        if (bed && bed.state === "occupied") {
          bed.state = "vacant";
          remaining -= 1;
        }
      }
    }
  }
  for (let i = rooms.length - 1; i >= 0 && remaining > 0; i -= 1) {
    if (FIXED_ROOMS.includes(rooms[i].no)) continue;
    const bed = rooms[i].beds.find((item) => item.state === "occupied");
    if (bed) {
      bed.state = "vacant";
      remaining -= 1;
    }
  }

  // One held and one maintenance bed, taken from already vacant beds so the
  // headline stays 101 occupied / 25 not occupied.
  const freeBeds: Bed[] = [];
  rooms.forEach((room) => {
    if (["101", "103", "201"].includes(room.no)) return;
    room.beds.forEach((bed) => {
      if (bed.state === "vacant") freeBeds.push(bed);
    });
  });
  if (freeBeds[0]) freeBeds[0].state = "maintenance";
  if (freeBeds[1]) freeBeds[1].state = "held";

  const residents: Resident[] = [];
  let index = 0;
  rooms.forEach((room) => {
    room.beds.forEach((bed) => {
      if (bed.state !== "occupied") return;
      const name =
        index < 6
          ? FIRST_NAMES[index] + " " + LAST_NAMES[index]
          : FIRST_NAMES[(index * 7) % 40] + " " + LAST_NAMES[(index * 11) % 30];
      const id = "R" + String(1001 + index);
      const resident: Resident = {
        id,
        name,
        initials: initialsOf(name),
        color: AVATAR_COLORS[index % 6],
        cnic:
          index === 0
            ? "35202-1234567-1"
            : "35202-" + (1000000 + ((index * 3571) % 8999999)) + "-" + ((index % 9) + 1),
        phone:
          index === 0
            ? "0301 2345678"
            : "03" + (index % 5) + (index % 9) + " " + (1000000 + ((index * 7919) % 8999999)),
        dob: "1" + (index % 9) + " Mar 200" + ((index % 6) + 1),
        institution: INSTITUTIONS[index % 10],
        occupation: index % 7 === 0 ? "Employee" : "Student",
        address:
          "House " + (12 + (index % 80)) + ", Street " + (1 + (index % 14)) + ", " +
          LAHORE_AREAS[index % 8] + ", Lahore",
        city: "Lahore",
        guardian: {
          name: FIRST_NAMES[(index * 13) % 40] + " " + LAST_NAMES[(index * 11) % 30],
          relationship: "Father",
          cnic: "35202-" + (1000000 + ((index * 7717) % 8999999)) + "-" + ((index % 8) + 1),
          phone: "030" + (index % 6) + " " + (1000000 + ((index * 5591) % 8999999)),
        },
        emergency: {
          name: FIRST_NAMES[(index * 17) % 40] + " " + LAST_NAMES[(index * 19) % 30],
          phone: "032" + (index % 5) + " " + (1000000 + ((index * 3301) % 8999999)),
        },
        room: room.no,
        bed: bed.id,
        floor: room.floor,
        roomType: room.type === 4 ? "Four-seater" : "Three-seater",
        rent: room.rent,
        joined:
          index === 0
            ? "04 Feb 2026"
            : (1 + (index % 27) < 10 ? "0" : "") + (1 + (index % 27)) + " " +
              ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index % 6] + " 2026",
        security: 3000,
        police: "verified",
        status: "active",
        documents: {
          photo: true,
          cnicFront: true,
          cnicBack: true,
          guardianCnic: index % 3 === 0,
        },
        checkoutDate: null,
        activity: [
          { title: "Rent received for Jul 2026", date: "03 Jul 2026" },
          { title: "Police form submitted", date: "12 Feb 2026" },
          {
            title: "Admitted to Room " + room.no + ", Bed " + bed.id,
            date: "04 Feb 2026",
          },
        ],
      };
      bed.residentId = id;
      residents.push(resident);
      index += 1;
    });
  });

  const pendingStages: PoliceStage[] = [
    "not_started",
    "not_started",
    "incomplete",
    "prepared",
    "submitted",
    "rejected",
  ];
  [20, 21, 22, 23, 24, 25].forEach((residentIndex, stageIndex) => {
    const resident = residents[residentIndex];
    if (resident) resident.police = pendingStages[stageIndex];
  });
  if (residents[22]) residents[22].missingDocument = "CNIC back image";
  if (residents[26]) residents[26].checkoutDate = "08 Aug 2026";
  if (residents[27]) residents[27].checkoutDate = "10 Aug 2026";

  const invoices: Invoice[] = residents.map((resident, i) => {
    let status: Invoice["status"] = "paid";
    let received = resident.rent;
    if (i >= 1 && i <= 3) {
      status = "proof";
      received = 0;
    } else if (i >= 4 && i <= 10) {
      status = "unpaid";
      received = 0;
    } else if (i >= 11 && i <= 15) {
      status = "overdue";
      received = 0;
    } else if (i >= 16 && i <= 18) {
      status = "partial";
      received = resident.rent - 4000;
    } else if (i === 19) {
      status = "waived";
      received = 0;
    }
    return {
      id: "INV-" + (3400 + i),
      residentId: resident.id,
      month: CURRENT_MONTH,
      due: resident.rent,
      received,
      status,
      dueDate: RENT_DUE_DATE,
      reminded: false,
    };
  });

  const proofMethods = ["JazzCash", "Easypaisa", "Bank Transfer"] as const;
  const proofRefs = ["JC-4471-8823", "EP-9932-1174", "HBL-77120934"];
  const proofSenders = [
    "0345 7781234",
    "0321 4456789",
    "PK36 HABB 0012 3456 7890",
  ];
  const proofTimes = ["09:42 am", "10:05 am", "11:18 am"];
  const proofs: PaymentProof[] = [1, 2, 3].map((residentIndex, i) => ({
    id: "PP-" + (210 + i),
    residentId: residents[residentIndex].id,
    amount: residents[residentIndex].rent,
    month: CURRENT_MONTH,
    method: proofMethods[i],
    reference: proofRefs[i],
    sender: proofSenders[i],
    submittedAt: "04 Aug 2026, " + proofTimes[i],
    status: "pending",
  }));

  return {
    rooms,
    residents,
    invoices,
    proofs,
    receipts: [],
    requests: [],
    enquiries: [
      {
        id: "E-41",
        name: "Talha Mehmood",
        phone: "0333 4455661",
        roomType: 4,
        expectedJoining: "06 Aug 2026",
        source: "Walk-in",
        status: "New",
        notes: "Visiting today, wants ground floor near mess.",
        createdAt: "04 Aug 2026",
      },
      {
        id: "E-40",
        name: "Ahmed Sultan",
        phone: "0301 9988771",
        roomType: 3,
        expectedJoining: "10 Aug 2026",
        source: "WhatsApp",
        status: "Visit Scheduled",
        notes: "Asked for attached washroom.",
        createdAt: "03 Aug 2026",
      },
      {
        id: "E-39",
        name: "Musab Iqbal",
        phone: "0345 1122334",
        roomType: 4,
        expectedJoining: "12 Aug 2026",
        source: "Referral",
        status: "Visited",
        notes: "Referred by Usman Tariq (Room 204).",
        createdAt: "02 Aug 2026",
      },
      {
        id: "E-38",
        name: "Rana Shahmeer",
        phone: "0312 7766554",
        roomType: 3,
        expectedJoining: "05 Aug 2026",
        source: "Property Listing",
        status: "Bed Held",
        notes: "Three-seater bed held till 05 Aug.",
        createdAt: "01 Aug 2026",
      },
    ],
    notices: [
      { title: "Water tanker cleaning on Friday morning", date: "02 Aug 2026" },
      { title: "Rent for August is due on 05 Aug", date: "01 Aug 2026" },
    ],
    notifications: {
      staff: [
        { title: "3 payment proofs waiting for review", date: "04 Aug 2026, 11:20 am", tone: "warn" },
        { title: "12 residents have not paid August rent", date: "04 Aug 2026, 09:00 am", tone: "bad" },
        { title: "6 police forms are pending", date: "03 Aug 2026, 06:10 pm", tone: "warn" },
        { title: "2 residents are checking out this week", date: "03 Aug 2026, 05:00 pm", tone: "ok" },
      ],
      resident: [
        { title: "Your August rent is due on 05 Aug.", date: "01 Aug 2026", tone: "warn" },
        { title: "Payment proof received and under review.", date: "04 Aug 2026", tone: "ok" },
        { title: "Your July payment has been verified.", date: "03 Jul 2026", tone: "ok" },
        { title: "A clearer payment screenshot is required.", date: "02 Jul 2026", tone: "bad" },
        { title: "Your police verification documents are incomplete.", date: "20 Feb 2026", tone: "warn" },
      ],
    },
    settings: {
      name: "H-K Boys Hostel",
      address: "Block C, Johar Town, Lahore, Pakistan",
      floors: 4,
      rooms: 36,
      beds: 126,
      rentThreeSeater: 9000,
      rentFourSeater: 7500,
      security: 3000,
      policeCharge: 300,
      dueDate: "5th of every month",
      methods: ["Cash", "Bank Transfer", "JazzCash", "Easypaisa"],
      bank: "HBL — H-K Boys Hostel — PK36 HABB 0012 3456 7890",
      jazzcash: "0301 2345678 (H-K Boys Hostel)",
      easypaisa: "0345 7654321 (H-K Boys Hostel)",
      receiptFooter:
        "Security deposit is refundable at checkout after deductions.",
      noticePeriod: "30 days",
      messCharges: false,
      utilityBilling: false,
    },
    currentResidentId: residents[0] ? residents[0].id : "",
    nextResidentSeq: 1001 + index,
  };
}
