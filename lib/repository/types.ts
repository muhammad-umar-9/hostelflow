import type {
  BedState,
  EnquiryStatus,
  HostelData,
  HostelSettings,
  PaymentMethod,
  PoliceStage,
} from "@/lib/types";

export interface AdmissionInput {
  name: string;
  cnic: string;
  dob: string;
  phone: string;
  address: string;
  city: string;
  institution: string;
  occupation: "Student" | "Employee";
  joining: string;
  guardianName: string;
  relationship: string;
  guardianCnic: string;
  guardianPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  documents: {
    photo: boolean;
    cnicFront: boolean;
    cnicBack: boolean;
    guardianCnic: boolean;
    admissionProof: boolean;
  };
  roomNo: string;
  bedId: string;
  method: PaymentMethod;
  amountPaid: number;
  reference: string;
}

export interface CheckoutInput {
  leavingDate: string;
  damageAmount: number;
  damageNote: string;
  otherCharges: number;
  refundMethod: PaymentMethod;
}

export interface EnquiryInput {
  name: string;
  phone: string;
  roomType: 3 | 4;
  expectedJoining: string;
  source: "Walk-in" | "WhatsApp" | "Facebook" | "Referral" | "Property Listing";
  notes: string;
}

export interface MutationResult {
  data: HostelData;
  message: string;
  residentId?: string;
  receiptId?: string;
}

/**
 * Every screen talks to this interface only. Swap MockHostelRepository for an
 * ApiHostelRepository (fetch calls to your PostgreSQL backend) without touching
 * a single component.
 */
export interface HostelRepository {
  getSnapshot(): Promise<HostelData>;
  reset(): Promise<HostelData>;
  admitResident(data: HostelData, input: AdmissionInput): Promise<MutationResult>;
  recordCashPayment(
    data: HostelData,
    residentId: string,
    amount: number,
  ): Promise<MutationResult>;
  approveProof(
    data: HostelData,
    proofId: string,
    amount: number,
  ): Promise<MutationResult>;
  rejectProof(data: HostelData, proofId: string, reason: string): Promise<MutationResult>;
  submitProof(data: HostelData, residentId: string): Promise<MutationResult>;
  sendReminders(data: HostelData, residentIds: string[]): Promise<MutationResult>;
  setBedState(
    data: HostelData,
    roomNo: string,
    bedId: string,
    state: BedState,
  ): Promise<MutationResult>;
  setPoliceStage(
    data: HostelData,
    residentId: string,
    stage: PoliceStage,
  ): Promise<MutationResult>;
  setEnquiryStatus(
    data: HostelData,
    enquiryId: string,
    status: EnquiryStatus,
  ): Promise<MutationResult>;
  addEnquiry(data: HostelData, input: EnquiryInput): Promise<MutationResult>;
  completeCheckout(
    data: HostelData,
    residentId: string,
    input: CheckoutInput,
  ): Promise<MutationResult>;
  addMaintenanceRequest(
    data: HostelData,
    residentId: string,
    title: string,
  ): Promise<MutationResult>;
  updateSettings(
    data: HostelData,
    patch: Partial<HostelSettings>,
  ): Promise<MutationResult>;
}
