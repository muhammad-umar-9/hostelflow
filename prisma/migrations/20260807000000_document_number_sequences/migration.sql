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
--
-- The highest number already used, not COUNT(*). Counting assumes the existing numbering
-- is dense, and a single gap — one voided invoice, one interrupted run — puts the counter
-- below a number that is already taken, so the next admission reproduces exactly the
-- collision this backfill exists to prevent. The suffix is read off the end of the
-- number, so INV-00007 and a hand-entered 2026/00007 both count.
UPDATE "hostel" h
SET "invoiceSequence" = COALESCE(
  (
    SELECT MAX((substring(i."number" FROM '[0-9]+$'))::bigint)
    FROM "invoice" i
    WHERE i."hostelId" = h."id"
      AND substring(i."number" FROM '[0-9]+$') IS NOT NULL
  ),
  0
);

UPDATE "hostel" h
SET "receiptSequence" = COALESCE(
  (
    SELECT MAX((substring(r."number" FROM '[0-9]+$'))::bigint)
    FROM "receipt" r
    WHERE r."hostelId" = h."id"
      AND substring(r."number" FROM '[0-9]+$') IS NOT NULL
  ),
  0
);
