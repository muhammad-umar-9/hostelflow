import type { PaymentMethod } from "@/lib/types";
import type { GuardianValues, PersonalInfoValues } from "@/lib/validations";

export interface AdmissionDocuments {
  photo: boolean;
  cnicFront: boolean;
  cnicBack: boolean;
  guardianCnic: boolean;
  admissionProof: boolean;
  [key: string]: boolean;
}

export interface AdmissionPayment {
  method: PaymentMethod | null;
  amount: number;
  reference: string;
  sender: string;
  payDate: string;
  proofAttached: boolean;
  cashConfirmed: boolean;
}

export interface AdmissionState {
  personal: PersonalInfoValues;
  guardian: GuardianValues;
  documents: AdmissionDocuments;
  linkSent: boolean;
  roomNo: string | null;
  bedId: string | null;
  payment: AdmissionPayment;
  consent: boolean;
}

export const ADMISSION_FORM_ID = "admission-step-form";
