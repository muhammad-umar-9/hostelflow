export type Role = "owner" | "manager" | "resident";

export type BedState = "vacant" | "occupied" | "held" | "maintenance" | "checkout";

export type PoliceStage =
  "not_started" | "incomplete" | "prepared" | "submitted" | "verified" | "rejected";

export type InvoiceStatus =
  "paid" | "unpaid" | "overdue" | "partial" | "proof" | "waived";

export type PaymentMethod = "Cash" | "Bank Transfer" | "JazzCash" | "Easypaisa";

export type EnquiryStatus =
  "New" | "Visit Scheduled" | "Visited" | "Bed Held" | "Admitted" | "Lost";

export interface Bed {
  id: string;
  state: BedState;
  residentId: string | null;
}

export interface Room {
  no: string;
  floor: string;
  floorKey: string;
  type: 3 | 4;
  rent: number;
  beds: Bed[];
}

export interface Guardian {
  name: string;
  relationship: string;
  cnic: string;
  phone: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface ResidentDocuments {
  photo: boolean;
  cnicFront: boolean;
  cnicBack: boolean;
  guardianCnic: boolean;
}

export interface ActivityEntry {
  title: string;
  date: string;
}

export interface Resident {
  id: string;
  name: string;
  initials: string;
  color: string;
  cnic: string;
  phone: string;
  dob: string;
  institution: string;
  occupation: "Student" | "Employee";
  address: string;
  city: string;
  guardian: Guardian;
  emergency: EmergencyContact;
  room: string;
  bed: string;
  floor: string;
  roomType: "Three-seater" | "Four-seater";
  rent: number;
  joined: string;
  security: number;
  police: PoliceStage;
  status: "active" | "former";
  documents: ResidentDocuments;
  missingDocument?: string;
  checkoutDate: string | null;
  activity: ActivityEntry[];
}

export interface Invoice {
  id: string;
  residentId: string;
  month: string;
  due: number;
  received: number;
  status: InvoiceStatus;
  dueDate: string;
  reminded: boolean;
}

export interface PaymentProof {
  id: string;
  residentId: string;
  amount: number;
  month: string;
  method: PaymentMethod;
  reference: string;
  sender: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  reason?: string | null;
}

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  roomType: 3 | 4;
  expectedJoining: string;
  source: "Walk-in" | "WhatsApp" | "Facebook" | "Referral" | "Property Listing";
  status: EnquiryStatus;
  notes: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  residentId: string;
  date: string;
  purpose: string;
  month: string;
  method: PaymentMethod | string;
  reference: string;
  rent: number;
  security: number;
  policeCharge: number;
  total: number;
  balance: number;
  verifiedBy: string;
  status: "Verified" | "Under Review";
  kind: "admission" | "rent" | "settlement";
}

export interface HostelSettings {
  name: string;
  address: string;
  floors: number;
  rooms: number;
  beds: number;
  rentThreeSeater: number;
  rentFourSeater: number;
  security: number;
  policeCharge: number;
  dueDate: string;
  methods: PaymentMethod[];
  bank: string;
  jazzcash: string;
  easypaisa: string;
  receiptFooter: string;
  noticePeriod: string;
  messCharges: boolean;
  utilityBilling: boolean;
}

export interface AppNotification {
  title: string;
  date: string;
  tone: "ok" | "warn" | "bad";
}

export interface MaintenanceRequest {
  id: string;
  residentId: string;
  title: string;
  date: string;
  status: "Open" | "In progress" | "Resolved";
}

export interface Notice {
  title: string;
  date: string;
}

export interface HostelData {
  rooms: Room[];
  residents: Resident[];
  invoices: Invoice[];
  proofs: PaymentProof[];
  enquiries: Enquiry[];
  receipts: Receipt[];
  requests: MaintenanceRequest[];
  notices: Notice[];
  notifications: { staff: AppNotification[]; resident: AppNotification[] };
  settings: HostelSettings;
  currentResidentId: string;
  nextResidentSeq: number;
}

export interface OccupancyStats {
  totalBeds: number;
  occupied: number;
  vacant: number;
  ready: number;
  held: number;
  maintenance: number;
  occupancyRate: string;
  expected: number;
  collected: number;
  outstanding: number;
  collectedPercent: number;
  unpaidResidents: number;
  pendingProofs: number;
  pendingPolice: number;
  leavingSoon: number;
}
