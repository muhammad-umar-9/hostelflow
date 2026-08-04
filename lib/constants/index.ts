import type { PaymentMethod } from "@/lib/types";

export const CURRENT_MONTH = "Aug 2026";
export const CURRENT_DATE = "04 Aug 2026";
export const RENT_DUE_DATE = "05 Aug 2026";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "JazzCash",
  "Easypaisa",
];

export const BED_STATE_LABELS: Record<string, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
  held: "Temporarily held",
  maintenance: "Maintenance",
  checkout: "Checkout pending",
};

export const POLICE_STAGE_LABELS: Record<string, string> = {
  not_started: "Not started",
  incomplete: "Documents incomplete",
  prepared: "Form prepared",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Correction required",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  partial: "Partial",
  proof: "Proof submitted",
  waived: "Waived",
};

export const FLOORS = [
  { key: "G", name: "Ground Floor", base: 100 },
  { key: "1", name: "First Floor", base: 200 },
  { key: "2", name: "Second Floor", base: 300 },
  { key: "3", name: "Third Floor", base: 400 },
];

export const MANAGER_NAME = "Manager · Rizwan Sattar";
