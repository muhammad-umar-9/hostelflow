import {
  CURRENT_DATE,
  CURRENT_MONTH,
  MANAGER_NAME,
  RENT_DUE_DATE,
} from "@/lib/constants";
import { formatPKR, initialsOf } from "@/lib/formatters";
import { generateHostelData } from "@/lib/mock-data";
import type {
  BedState,
  EnquiryStatus,
  HostelData,
  HostelSettings,
  PoliceStage,
  Receipt,
} from "@/lib/types";
import type {
  AdmissionInput,
  CheckoutInput,
  EnquiryInput,
  HostelRepository,
  MutationResult,
} from "./types";

const LATENCY = 260;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone(data: HostelData): HostelData {
  return JSON.parse(JSON.stringify(data)) as HostelData;
}

export class MockHostelRepository implements HostelRepository {
  async getSnapshot(): Promise<HostelData> {
    return delay(generateHostelData(), 380);
  }

  async reset(): Promise<HostelData> {
    return delay(generateHostelData(), 320);
  }

  async admitResident(data: HostelData, input: AdmissionInput): Promise<MutationResult> {
    const next = clone(data);
    const room = next.rooms.find((item) => item.no === input.roomNo);
    if (!room) return delay({ data: next, message: "Room not found" });
    const bed = room.beds.find((item) => item.id === input.bedId);
    if (!bed) return delay({ data: next, message: "Bed not found" });
    if (bed.state === "occupied") {
      return delay({
        data: next,
        message: "That bed was just taken. Pick another vacant bed.",
      });
    }
    if (next.residents.some((r) => r.status === "active" && r.cnic === input.cnic)) {
      return delay({
        data: next,
        message: "An active resident already exists with this CNIC.",
      });
    }

    const id = "R" + next.nextResidentSeq;
    next.nextResidentSeq += 1;
    const total = room.rent + next.settings.security + next.settings.policeCharge;
    const isCash = input.method === "Cash";

    next.residents.unshift({
      id,
      name: input.name,
      initials: initialsOf(input.name),
      color: "#0e9c6c",
      cnic: input.cnic,
      phone: input.phone,
      dob: input.dob,
      institution: input.institution,
      occupation: input.occupation,
      address: input.address,
      city: input.city,
      guardian: {
        name: input.guardianName,
        relationship: input.relationship,
        cnic: input.guardianCnic,
        phone: input.guardianPhone,
      },
      emergency: { name: input.emergencyName, phone: input.emergencyPhone },
      room: room.no,
      bed: bed.id,
      floor: room.floor,
      roomType: room.type === 4 ? "Four-seater" : "Three-seater",
      rent: room.rent,
      joined: input.joining,
      security: next.settings.security,
      police: "not_started",
      status: "active",
      documents: {
        photo: input.documents.photo,
        cnicFront: input.documents.cnicFront,
        cnicBack: input.documents.cnicBack,
        guardianCnic: input.documents.guardianCnic,
      },
      checkoutDate: null,
      activity: [
        { title: "Admitted to Room " + room.no + ", Bed " + bed.id, date: input.joining },
        {
          title: "Security deposit " + formatPKR(next.settings.security) + " recorded",
          date: input.joining,
        },
      ],
    });

    bed.state = "occupied";
    bed.residentId = id;

    next.invoices.unshift({
      id: "INV-" + (3500 + next.nextResidentSeq),
      residentId: id,
      month: CURRENT_MONTH,
      due: room.rent,
      received: isCash ? Math.min(input.amountPaid, room.rent) : 0,
      status: isCash ? (input.amountPaid >= total ? "paid" : "partial") : "proof",
      dueDate: RENT_DUE_DATE,
      reminded: false,
    });

    if (!isCash) {
      next.proofs.unshift({
        id: "PP-" + (300 + next.nextResidentSeq),
        residentId: id,
        amount: input.amountPaid,
        month: CURRENT_MONTH,
        method: input.method,
        reference: input.reference,
        sender: input.phone,
        submittedAt: CURRENT_DATE + ", 10:24 am",
        status: "pending",
      });
    }

    const receipt: Receipt = {
      id: "HK-2026-" + (1200 + next.nextResidentSeq),
      residentId: id,
      date: CURRENT_DATE + ", 10:24 am",
      purpose: "Admission — first month rent, security and police form",
      month: CURRENT_MONTH,
      method: input.method,
      reference: isCash ? "Cash received at front desk" : input.reference,
      rent: room.rent,
      security: next.settings.security,
      policeCharge: next.settings.policeCharge,
      total: input.amountPaid,
      balance: Math.max(0, total - input.amountPaid),
      verifiedBy: MANAGER_NAME,
      status: isCash ? "Verified" : "Under Review",
      kind: "admission",
    };
    next.receipts.unshift(receipt);

    return delay(
      {
        data: next,
        message: "Resident admitted successfully",
        residentId: id,
        receiptId: receipt.id,
      },
      700,
    );
  }

  async recordCashPayment(
    data: HostelData,
    residentId: string,
    amount: number,
  ): Promise<MutationResult> {
    const next = clone(data);
    const invoice = next.invoices.find(
      (item) => item.residentId === residentId && item.month === CURRENT_MONTH,
    );
    if (!invoice) return delay({ data: next, message: "No invoice for this month" });
    if (amount <= 0)
      return delay({ data: next, message: "Enter an amount before recording" });
    invoice.received = Math.min(invoice.due, invoice.received + amount);
    invoice.status = invoice.received >= invoice.due ? "paid" : "partial";
    const receipt: Receipt = {
      id: "HK-2026-" + (1300 + next.receipts.length),
      residentId,
      date: CURRENT_DATE + ", 10:26 am",
      purpose: "Monthly rent — August 2026",
      month: CURRENT_MONTH,
      method: "Cash",
      reference: "Cash received at front desk",
      rent: amount,
      security: 0,
      policeCharge: 0,
      total: amount,
      balance: invoice.due - invoice.received,
      verifiedBy: MANAGER_NAME,
      status: "Verified",
      kind: "rent",
    };
    next.receipts.unshift(receipt);
    const resident = next.residents.find((item) => item.id === residentId);
    if (resident) {
      resident.activity.unshift({
        title: "Payment of " + formatPKR(amount) + " received (Cash)",
        date: CURRENT_DATE,
      });
    }
    return delay({
      data: next,
      message: "Rent recorded — receipt generated",
      receiptId: receipt.id,
    });
  }

  async approveProof(
    data: HostelData,
    proofId: string,
    amount: number,
  ): Promise<MutationResult> {
    const next = clone(data);
    const proof = next.proofs.find((item) => item.id === proofId);
    if (!proof) return delay({ data: next, message: "Proof not found" });
    if (!amount || amount <= 0) {
      return delay({ data: next, message: "Approval needs an amount" });
    }
    proof.status = "approved";
    const invoice = next.invoices.find(
      (item) => item.residentId === proof.residentId && item.month === CURRENT_MONTH,
    );
    if (invoice) {
      invoice.received = Math.min(invoice.due, amount);
      invoice.status = invoice.received >= invoice.due ? "paid" : "partial";
    }
    const resident = next.residents.find((item) => item.id === proof.residentId);
    const receipt: Receipt = {
      id: "HK-2026-" + (1400 + next.receipts.length),
      residentId: proof.residentId,
      date: CURRENT_DATE + ", 10:28 am",
      purpose: "Monthly rent — August 2026",
      month: CURRENT_MONTH,
      method: proof.method,
      reference: proof.reference,
      rent: amount,
      security: 0,
      policeCharge: 0,
      total: amount,
      balance: Math.max(0, (resident ? resident.rent : 0) - amount),
      verifiedBy: MANAGER_NAME,
      status: "Verified",
      kind: "rent",
    };
    next.receipts.unshift(receipt);
    next.notifications.resident.unshift({
      title: "Your August payment has been verified.",
      date: CURRENT_DATE,
      tone: "ok",
    });
    return delay(
      {
        data: next,
        message: "Payment approved — invoice updated",
        receiptId: receipt.id,
      },
      600,
    );
  }

  async rejectProof(
    data: HostelData,
    proofId: string,
    reason: string,
  ): Promise<MutationResult> {
    const next = clone(data);
    const proof = next.proofs.find((item) => item.id === proofId);
    if (!proof) return delay({ data: next, message: "Proof not found" });
    if (!reason) return delay({ data: next, message: "A rejection reason is required" });
    proof.status = "rejected";
    proof.reason = reason;
    const invoice = next.invoices.find(
      (item) => item.residentId === proof.residentId && item.month === CURRENT_MONTH,
    );
    if (invoice) {
      invoice.status = "unpaid";
      invoice.received = 0;
    }
    next.notifications.resident.unshift({
      title: reason,
      date: CURRENT_DATE,
      tone: "bad",
    });
    return delay({ data: next, message: "Proof rejected — resident notified" });
  }

  async submitProof(data: HostelData, residentId: string): Promise<MutationResult> {
    const next = clone(data);
    const resident = next.residents.find((item) => item.id === residentId);
    if (!resident) return delay({ data: next, message: "Resident not found" });
    const invoice = next.invoices.find(
      (item) => item.residentId === residentId && item.month === CURRENT_MONTH,
    );
    const amount = invoice ? invoice.due - invoice.received : resident.rent;
    next.proofs.unshift({
      id: "PP-" + (400 + next.proofs.length),
      residentId,
      amount,
      month: CURRENT_MONTH,
      method: "JazzCash",
      reference: "JC-5521-3390",
      sender: resident.phone,
      submittedAt: CURRENT_DATE + ", 10:31 am",
      status: "pending",
    });
    if (invoice) invoice.status = "proof";
    return delay({ data: next, message: "Proof submitted — the manager will review it" });
  }

  async sendReminders(data: HostelData, residentIds: string[]): Promise<MutationResult> {
    const next = clone(data);
    next.invoices.forEach((invoice) => {
      if (residentIds.includes(invoice.residentId)) invoice.reminded = true;
    });
    return delay(
      {
        data: next,
        message: "Reminders sent to " + residentIds.length + " residents on WhatsApp",
      },
      620,
    );
  }

  async setBedState(
    data: HostelData,
    roomNo: string,
    bedId: string,
    state: BedState,
  ): Promise<MutationResult> {
    const next = clone(data);
    const room = next.rooms.find((item) => item.no === roomNo);
    const bed = room ? room.beds.find((item) => item.id === bedId) : undefined;
    if (!bed) return delay({ data: next, message: "Bed not found" });
    if (bed.state === "occupied" && state !== "occupied") {
      return delay({ data: next, message: "Move or check out the resident first" });
    }
    bed.state = state;
    if (state !== "occupied") bed.residentId = null;
    const labels: Record<string, string> = {
      vacant: "Bed is vacant again",
      held: "Bed held for a visitor",
      maintenance: "Bed marked under maintenance",
      occupied: "Bed marked occupied",
      checkout: "Bed marked checkout pending",
    };
    return delay({ data: next, message: labels[state] });
  }

  async setPoliceStage(
    data: HostelData,
    residentId: string,
    stage: PoliceStage,
  ): Promise<MutationResult> {
    const next = clone(data);
    const resident = next.residents.find((item) => item.id === residentId);
    if (!resident) return delay({ data: next, message: "Resident not found" });
    resident.police = stage;
    resident.activity.unshift({
      title: "Police verification marked " + stage.replace("_", " "),
      date: CURRENT_DATE,
    });
    return delay({ data: next, message: "Police status updated" });
  }

  async setEnquiryStatus(
    data: HostelData,
    enquiryId: string,
    status: EnquiryStatus,
  ): Promise<MutationResult> {
    const next = clone(data);
    const enquiry = next.enquiries.find((item) => item.id === enquiryId);
    if (!enquiry) return delay({ data: next, message: "Enquiry not found" });
    enquiry.status = status;
    return delay({ data: next, message: "Enquiry marked " + status });
  }

  async addEnquiry(data: HostelData, input: EnquiryInput): Promise<MutationResult> {
    const next = clone(data);
    next.enquiries.unshift({
      id: "E-" + (42 + next.enquiries.length),
      name: input.name,
      phone: input.phone,
      roomType: input.roomType,
      expectedJoining: input.expectedJoining,
      source: input.source,
      status: "New",
      notes: input.notes,
      createdAt: CURRENT_DATE,
    });
    return delay({ data: next, message: "Enquiry saved" });
  }

  async completeCheckout(
    data: HostelData,
    residentId: string,
    input: CheckoutInput,
  ): Promise<MutationResult> {
    const next = clone(data);
    const resident = next.residents.find((item) => item.id === residentId);
    if (!resident) return delay({ data: next, message: "Resident not found" });
    const invoice = next.invoices.find(
      (item) => item.residentId === residentId && item.month === CURRENT_MONTH,
    );
    const unpaid = invoice ? Math.max(0, invoice.due - invoice.received) : 0;
    const deductions = unpaid + input.damageAmount + input.otherCharges;
    const refund = Math.max(0, resident.security - deductions);

    const room = next.rooms.find((item) => item.no === resident.room);
    const bed = room ? room.beds.find((item) => item.id === resident.bed) : undefined;
    if (bed) {
      bed.state = "vacant";
      bed.residentId = null;
    }
    resident.status = "former";
    resident.checkoutDate = input.leavingDate;
    resident.activity.unshift({
      title: "Checked out — security settled, " + formatPKR(refund) + " refunded",
      date: input.leavingDate,
    });

    const receipt: Receipt = {
      id: "HK-2026-S" + (1500 + next.receipts.length),
      residentId,
      date: input.leavingDate + ", 12:10 pm",
      purpose: "Checkout settlement — security deposit refund",
      month: CURRENT_MONTH,
      method: input.refundMethod,
      reference: "Settlement · deductions " + formatPKR(deductions),
      rent: 0,
      security: resident.security,
      policeCharge: 0,
      total: refund,
      balance: 0,
      verifiedBy: MANAGER_NAME,
      status: "Verified",
      kind: "settlement",
    };
    next.receipts.unshift(receipt);
    return delay(
      {
        data: next,
        message: "Checkout complete — bed is vacant again",
        receiptId: receipt.id,
      },
      700,
    );
  }

  async addMaintenanceRequest(
    data: HostelData,
    residentId: string,
    title: string,
  ): Promise<MutationResult> {
    const next = clone(data);
    next.requests.unshift({
      id: "MR-" + (100 + next.requests.length),
      residentId,
      title,
      date: CURRENT_DATE,
      status: "Open",
    });
    return delay({ data: next, message: "Maintenance request sent to the manager" });
  }

  async updateSettings(
    data: HostelData,
    patch: Partial<HostelSettings>,
  ): Promise<MutationResult> {
    const next = clone(data);
    next.settings = { ...next.settings, ...patch };
    return delay({ data: next, message: "Settings updated" });
  }
}
