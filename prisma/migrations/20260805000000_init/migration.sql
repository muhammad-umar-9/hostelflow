-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'RESIDENT');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('VACANT', 'HELD', 'OCCUPIED', 'CHECKOUT_PENDING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('RENT', 'SECURITY_DEPOSIT', 'POLICE_FORM', 'DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'VISIT_SCHEDULED', 'VISITED', 'BED_HELD', 'ADMITTED', 'LOST');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WALK_IN', 'WHATSAPP', 'FACEBOOK', 'REFERRAL', 'PROPERTY_LISTING');

-- CreateEnum
CREATE TYPE "Occupation" AS ENUM ('STUDENT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('ACTIVE', 'FORMER');

-- CreateEnum
CREATE TYPE "StoredObjectKind" AS ENUM ('RESIDENT_PHOTO', 'CNIC_FRONT', 'CNIC_BACK', 'GUARDIAN_CNIC', 'STUDENT_CARD', 'PAYMENT_PROOF', 'POLICE_ACKNOWLEDGEMENT', 'DAMAGE_PHOTO', 'RECEIPT_PDF', 'SETTLEMENT_PDF');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CHECKOUT_PENDING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ADMISSION', 'MONTHLY_RENT', 'SETTLEMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLEARER_PROOF_REQUIRED');

-- CreateEnum
CREATE TYPE "DepositEntryType" AS ENUM ('RECEIVED', 'DEDUCTION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PoliceStatus" AS ENUM ('NOT_STARTED', 'DOCUMENTS_INCOMPLETE', 'FORM_PREPARED', 'SUBMITTED', 'VERIFIED', 'CORRECTION_REQUIRED');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptKind" AS ENUM ('ADMISSION', 'RENT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "rentDueDay" INTEGER NOT NULL DEFAULT 5,
    "bedHoldHours" INTEGER NOT NULL DEFAULT 48,
    "depositDeductionApprovalLimitPkr" INTEGER NOT NULL DEFAULT 1000,
    "receiptFooter" TEXT,
    "bankAccountLabel" TEXT,
    "jazzCashLabel" TEXT,
    "easyPaisaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_membership" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "hostel_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_type" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "monthlyRentPkr" INTEGER NOT NULL,

    CONSTRAINT "room_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'VACANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_type" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "defaultAmountPkr" INTEGER,
    "oneTime" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "charge_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredRoomTypeId" TEXT,
    "expectedJoiningDate" TIMESTAMP(3),
    "source" "EnquirySource" NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "lostReason" TEXT,
    "visitScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_event" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_hold" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeBedId" TEXT,

    CONSTRAINT "bed_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "cnicNormalized" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "institution" TEXT,
    "occupation" "Occupation" NOT NULL DEFAULT 'STUDENT',
    "status" "ResidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeCnicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "cnicNormalized" TEXT,
    "phone" TEXT NOT NULL,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_object" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "kind" "StoredObjectKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "originalFilename" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stored_object_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_document" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "kind" "StoredObjectKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resident_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_log" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "agreedMonthlyRentPkr" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "activeResidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_allocation" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdByUserId" TEXT,
    "activeBedId" TEXT,

    CONSTRAINT "bed_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3),
    "monthlyKey" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalPkr" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "chargeTypeId" TEXT,
    "kind" "ChargeKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountPkr" INTEGER NOT NULL,
    "reference" TEXT,
    "senderName" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reversalOfPaymentId" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proof" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "objectId" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "claimedAmountPkr" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "senderName" TEXT,
    "paidAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "payment_proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proof_event" (
    "id" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "status" "PaymentProofStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_proof_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_deposit_ledger" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "entryType" "DepositEntryType" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "reason" TEXT,
    "checkoutId" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_deposit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "police_verification" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "status" "PoliceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "policeStation" TEXT,
    "referenceNumber" TEXT,
    "preparedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "missingDocuments" TEXT,
    "acknowledgementObjectId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "police_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "police_verification_event" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "status" "PoliceStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "police_verification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'DRAFT',
    "intendedLeavingDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "depositHeldPkr" INTEGER NOT NULL DEFAULT 0,
    "outstandingRentPkr" INTEGER NOT NULL DEFAULT 0,
    "damageTotalPkr" INTEGER NOT NULL DEFAULT 0,
    "otherChargesPkr" INTEGER NOT NULL DEFAULT 0,
    "refundablePkr" INTEGER NOT NULL DEFAULT 0,
    "refundMethod" "PaymentMethod",
    "refundReference" TEXT,
    "refundedAt" TIMESTAMP(3),
    "handledByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_deduction" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "photoObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "admissionId" TEXT,
    "paymentId" TEXT,
    "checkoutId" TEXT,
    "kind" "ReceiptKind" NOT NULL,
    "number" TEXT NOT NULL,
    "totalReceivedPkr" INTEGER NOT NULL,
    "balancePkr" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "pdfObjectId" TEXT,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_request" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "MembershipRole",
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_disabledAt_idx" ON "user"("disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_slug_key" ON "hostel"("slug");

-- CreateIndex
CREATE INDEX "hostel_membership_userId_idx" ON "hostel_membership"("userId");

-- CreateIndex
CREATE INDEX "hostel_membership_hostelId_role_idx" ON "hostel_membership"("hostelId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_membership_hostelId_userId_key" ON "hostel_membership"("hostelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "floor_hostelId_level_key" ON "floor"("hostelId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "room_type_hostelId_code_key" ON "room_type"("hostelId", "code");

-- CreateIndex
CREATE INDEX "room_hostelId_floorId_idx" ON "room"("hostelId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "room_hostelId_number_key" ON "room"("hostelId", "number");

-- CreateIndex
CREATE INDEX "bed_hostelId_status_idx" ON "bed"("hostelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bed_roomId_label_key" ON "bed"("roomId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "charge_type_hostelId_code_key" ON "charge_type"("hostelId", "code");

-- CreateIndex
CREATE INDEX "enquiry_hostelId_status_idx" ON "enquiry"("hostelId", "status");

-- CreateIndex
CREATE INDEX "enquiry_hostelId_phone_idx" ON "enquiry"("hostelId", "phone");

-- CreateIndex
CREATE INDEX "enquiry_event_enquiryId_createdAt_idx" ON "enquiry_event"("enquiryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bed_hold_activeBedId_key" ON "bed_hold"("activeBedId");

-- CreateIndex
CREATE INDEX "bed_hold_hostelId_expiresAt_idx" ON "bed_hold"("hostelId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "resident_userId_key" ON "resident"("userId");

-- CreateIndex
CREATE INDEX "resident_hostelId_status_idx" ON "resident"("hostelId", "status");

-- CreateIndex
CREATE INDEX "resident_hostelId_cnicNormalized_idx" ON "resident"("hostelId", "cnicNormalized");

-- CreateIndex
CREATE INDEX "resident_hostelId_phone_idx" ON "resident"("hostelId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "resident_hostelId_activeCnicKey_key" ON "resident"("hostelId", "activeCnicKey");

-- CreateIndex
CREATE INDEX "guardian_residentId_idx" ON "guardian"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "stored_object_objectKey_key" ON "stored_object"("objectKey");

-- CreateIndex
CREATE INDEX "stored_object_hostelId_kind_idx" ON "stored_object"("hostelId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "resident_document_objectId_key" ON "resident_document"("objectId");

-- CreateIndex
CREATE INDEX "resident_document_residentId_kind_idx" ON "resident_document"("residentId", "kind");

-- CreateIndex
CREATE INDEX "document_access_log_objectId_createdAt_idx" ON "document_access_log"("objectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admission_activeResidentId_key" ON "admission"("activeResidentId");

-- CreateIndex
CREATE INDEX "admission_hostelId_status_idx" ON "admission"("hostelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bed_allocation_activeBedId_key" ON "bed_allocation"("activeBedId");

-- CreateIndex
CREATE INDEX "bed_allocation_hostelId_bedId_idx" ON "bed_allocation"("hostelId", "bedId");

-- CreateIndex
CREATE INDEX "bed_allocation_admissionId_idx" ON "bed_allocation"("admissionId");

-- CreateIndex
CREATE INDEX "invoice_hostelId_status_idx" ON "invoice"("hostelId", "status");

-- CreateIndex
CREATE INDEX "invoice_hostelId_dueDate_idx" ON "invoice"("hostelId", "dueDate");

-- CreateIndex
CREATE INDEX "invoice_residentId_idx" ON "invoice"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_hostelId_number_key" ON "invoice"("hostelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_admissionId_monthlyKey_key" ON "invoice"("admissionId", "monthlyKey");

-- CreateIndex
CREATE INDEX "invoice_line_invoiceId_idx" ON "invoice_line"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversalOfPaymentId_key" ON "payment"("reversalOfPaymentId");

-- CreateIndex
CREATE INDEX "payment_hostelId_status_idx" ON "payment"("hostelId", "status");

-- CreateIndex
CREATE INDEX "payment_residentId_idx" ON "payment"("residentId");

-- CreateIndex
CREATE INDEX "payment_allocation_invoiceLineId_idx" ON "payment_allocation"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocation_paymentId_invoiceLineId_key" ON "payment_allocation"("paymentId", "invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_proof_paymentId_key" ON "payment_proof"("paymentId");

-- CreateIndex
CREATE INDEX "payment_proof_hostelId_status_idx" ON "payment_proof"("hostelId", "status");

-- CreateIndex
CREATE INDEX "payment_proof_residentId_idx" ON "payment_proof"("residentId");

-- CreateIndex
CREATE INDEX "payment_proof_event_proofId_createdAt_idx" ON "payment_proof_event"("proofId", "createdAt");

-- CreateIndex
CREATE INDEX "security_deposit_ledger_hostelId_residentId_idx" ON "security_deposit_ledger"("hostelId", "residentId");

-- CreateIndex
CREATE INDEX "security_deposit_ledger_admissionId_idx" ON "security_deposit_ledger"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "police_verification_admissionId_key" ON "police_verification"("admissionId");

-- CreateIndex
CREATE INDEX "police_verification_hostelId_status_idx" ON "police_verification"("hostelId", "status");

-- CreateIndex
CREATE INDEX "police_verification_event_verificationId_createdAt_idx" ON "police_verification_event"("verificationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_admissionId_key" ON "checkout"("admissionId");

-- CreateIndex
CREATE INDEX "checkout_hostelId_status_idx" ON "checkout"("hostelId", "status");

-- CreateIndex
CREATE INDEX "damage_deduction_checkoutId_idx" ON "damage_deduction"("checkoutId");

-- CreateIndex
CREATE INDEX "receipt_residentId_idx" ON "receipt"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_hostelId_number_key" ON "receipt"("hostelId", "number");

-- CreateIndex
CREATE INDEX "maintenance_request_hostelId_status_idx" ON "maintenance_request"("hostelId", "status");

-- CreateIndex
CREATE INDEX "notification_hostelId_userId_readAt_idx" ON "notification"("hostelId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_log_hostelId_createdAt_idx" ON "audit_log"("hostelId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_actorUserId_createdAt_idx" ON "audit_log"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_membership" ADD CONSTRAINT "hostel_membership_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_membership" ADD CONSTRAINT "hostel_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor" ADD CONSTRAINT "floor_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_type" ADD CONSTRAINT "room_type_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_type" ADD CONSTRAINT "charge_type_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_preferredRoomTypeId_fkey" FOREIGN KEY ("preferredRoomTypeId") REFERENCES "room_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_event" ADD CONSTRAINT "enquiry_event_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_hold" ADD CONSTRAINT "bed_hold_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_hold" ADD CONSTRAINT "bed_hold_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "bed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_hold" ADD CONSTRAINT "bed_hold_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident" ADD CONSTRAINT "resident_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident" ADD CONSTRAINT "resident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_object" ADD CONSTRAINT "stored_object_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_object" ADD CONSTRAINT "stored_object_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_document" ADD CONSTRAINT "resident_document_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_document" ADD CONSTRAINT "resident_document_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "stored_object"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "stored_object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission" ADD CONSTRAINT "admission_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocation" ADD CONSTRAINT "bed_allocation_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocation" ADD CONSTRAINT "bed_allocation_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocation" ADD CONSTRAINT "bed_allocation_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocation" ADD CONSTRAINT "bed_allocation_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocation" ADD CONSTRAINT "bed_allocation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_chargeTypeId_fkey" FOREIGN KEY ("chargeTypeId") REFERENCES "charge_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_reversalOfPaymentId_fkey" FOREIGN KEY ("reversalOfPaymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "invoice_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "stored_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proof_event" ADD CONSTRAINT "payment_proof_event_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "payment_proof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposit_ledger" ADD CONSTRAINT "security_deposit_ledger_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposit_ledger" ADD CONSTRAINT "security_deposit_ledger_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposit_ledger" ADD CONSTRAINT "security_deposit_ledger_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposit_ledger" ADD CONSTRAINT "security_deposit_ledger_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "checkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposit_ledger" ADD CONSTRAINT "security_deposit_ledger_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification" ADD CONSTRAINT "police_verification_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification" ADD CONSTRAINT "police_verification_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification" ADD CONSTRAINT "police_verification_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification" ADD CONSTRAINT "police_verification_acknowledgementObjectId_fkey" FOREIGN KEY ("acknowledgementObjectId") REFERENCES "stored_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification" ADD CONSTRAINT "police_verification_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "police_verification_event" ADD CONSTRAINT "police_verification_event_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "police_verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_deduction" ADD CONSTRAINT "damage_deduction_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "checkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_deduction" ADD CONSTRAINT "damage_deduction_photoObjectId_fkey" FOREIGN KEY ("photoObjectId") REFERENCES "stored_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "checkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_pdfObjectId_fkey" FOREIGN KEY ("pdfObjectId") REFERENCES "stored_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Append-only enforcement for the audit trail.
--
-- Prisma cannot express this, so it is hand-written and kept with the migration
-- that creates the tables. A trigger is used rather than a GRANT because the
-- application connects as the owner of these tables, and an owner can always
-- restore a privilege it revoked from itself. A trigger refuses the write no
-- matter which role attempts it, including the application itself.
--
-- Consequence, and it is deliberate: audit rows can never be corrected. A wrong
-- entry is answered with a new entry, exactly like the financial ledgers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION hostelflow_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION hostelflow_append_only();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION hostelflow_append_only();

CREATE TRIGGER document_access_log_no_update
  BEFORE UPDATE ON "document_access_log"
  FOR EACH ROW EXECUTE FUNCTION hostelflow_append_only();

CREATE TRIGGER document_access_log_no_delete
  BEFORE DELETE ON "document_access_log"
  FOR EACH ROW EXECUTE FUNCTION hostelflow_append_only();
