-- AlterTable
ALTER TABLE "hostel" ADD COLUMN     "invoiceSequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "receiptSequence" INTEGER NOT NULL DEFAULT 0;


-- Backfill, so an existing database does not restart numbering at 1.
--
-- Without this the counters begin at 0 on a hostel that already has invoices — from the
-- demo seed, or from any earlier run — and the next admission generates INV-00001, which
-- collides with the existing row on invoice(hostelId, number). The caller would see a raw
-- constraint error, since that conflict is none of the bed/CNIC/admission cases the
-- application knows how to explain.
UPDATE "hostel" h
SET "invoiceSequence" = COALESCE(
  (SELECT COUNT(*)::int FROM "invoice" i WHERE i."hostelId" = h."id"), 0
);

UPDATE "hostel" h
SET "receiptSequence" = COALESCE(
  (SELECT COUNT(*)::int FROM "receipt" r WHERE r."hostelId" = h."id"), 0
);
