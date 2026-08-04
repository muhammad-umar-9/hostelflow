import { z } from "zod";

export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;
export const PHONE_REGEX = /^03\d{2}\s?\d{7}$/;

export const personalInfoSchema = z.object({
  name: z.string().min(3, "Enter the full name"),
  cnic: z.string().regex(CNIC_REGEX, "CNIC must look like 35202-1234567-1"),
  dob: z.string().min(4, "Date of birth is required"),
  phone: z
    .string()
    .regex(PHONE_REGEX, "Enter a mobile number like 0301 2345678"),
  address: z.string().min(6, "Permanent address is required"),
  city: z.string().min(2, "City is required"),
  institution: z.string().min(2, "Institution or workplace is required"),
  occupation: z.enum(["Student", "Employee"]),
  joining: z.string().min(4, "Joining date is required"),
});

export const guardianSchema = z.object({
  guardianName: z.string().min(3, "Guardian name is required"),
  relationship: z.string().min(3, "Relationship is required"),
  guardianCnic: z
    .string()
    .regex(CNIC_REGEX, "Guardian CNIC must look like 35202-1234567-1"),
  guardianPhone: z.string().regex(PHONE_REGEX, "Enter a valid mobile number"),
  emergencyName: z.string().min(3, "Emergency contact name is required"),
  emergencyPhone: z.string().regex(PHONE_REGEX, "Enter a valid mobile number"),
});

export const paymentSchema = z.object({
  method: z.enum(["Cash", "Bank Transfer", "JazzCash", "Easypaisa"], {
    required_error: "Choose how the payment was made",
  }),
  amount: z.coerce.number().positive("Enter the amount received"),
  reference: z.string().optional(),
  sender: z.string().optional(),
  payDate: z.string().optional(),
});

export const loginSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, "Enter a number like 0300 1234567"),
  otp: z.string().length(4, "Enter the 4-digit code"),
  role: z.enum(["owner", "manager", "resident"]),
});

export const enquirySchema = z.object({
  name: z.string().min(3, "Student name is required"),
  phone: z.string().regex(PHONE_REGEX, "Enter a valid WhatsApp number"),
  roomType: z.coerce.number().refine((v) => v === 3 || v === 4, "Choose a room type"),
  expectedJoining: z.string().min(4, "Expected joining date is required"),
  source: z.enum([
    "Walk-in",
    "WhatsApp",
    "Facebook",
    "Referral",
    "Property Listing",
  ]),
  notes: z.string().optional(),
});

export const checkoutSchema = z.object({
  leavingDate: z.string().min(4, "Select the intended leaving date"),
  damageAmount: z.coerce.number().min(0),
  damageNote: z.string().optional(),
  otherCharges: z.coerce.number().min(0),
  refundMethod: z.enum(["Cash", "Bank Transfer", "JazzCash", "Easypaisa"]),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "Confirm the settlement before checkout" }),
  }),
});

export type PersonalInfoValues = z.infer<typeof personalInfoSchema>;
export type GuardianValues = z.infer<typeof guardianSchema>;
export type PaymentValues = z.infer<typeof paymentSchema>;
export type EnquiryValues = z.infer<typeof enquirySchema>;
export type CheckoutValues = z.infer<typeof checkoutSchema>;
