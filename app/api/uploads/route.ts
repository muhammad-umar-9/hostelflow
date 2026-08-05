import { NextResponse } from "next/server";
import { StoredObjectKind } from "@/lib/generated/prisma/enums";
import { recordAudit, requestContext } from "@/lib/server/audit";
import { requirePermission, statusForError } from "@/lib/server/authz";
import { prisma } from "@/lib/server/db";
import {
  StorageError,
  buildObjectKey,
  putPrivateObject,
  validateUpload,
} from "@/lib/server/storage";
import { createHash } from "node:crypto";

/**
 * Protected upload.
 *
 * Order matters and is deliberate: authorize, then validate the bytes, then store, then
 * record. Nothing reaches MinIO before the caller is known to be staff of this hostel and
 * the file has been proven to be an image or a PDF by its own contents.
 *
 * The response deliberately returns only the database id. The object key is an internal
 * detail; handing it to the browser invites someone to try constructing their own URLs.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOADABLE_KINDS = new Set<StoredObjectKind>([
  StoredObjectKind.RESIDENT_PHOTO,
  StoredObjectKind.CNIC_FRONT,
  StoredObjectKind.CNIC_BACK,
  StoredObjectKind.GUARDIAN_CNIC,
  StoredObjectKind.STUDENT_CARD,
  StoredObjectKind.PAYMENT_PROOF,
  StoredObjectKind.POLICE_ACKNOWLEDGEMENT,
  StoredObjectKind.DAMAGE_PHOTO,
]);

function isUploadableKind(value: string): value is StoredObjectKind {
  return UPLOADABLE_KINDS.has(value as StoredObjectKind);
}

export async function POST(request: Request) {
  try {
    const { user, membership } = await requirePermission("residents.write");

    const form = await request.formData();
    const file = form.get("file");
    const kindValue = String(form.get("kind") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
    }
    if (!isUploadableKind(kindValue)) {
      return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { mimeType } = validateUpload({
      declaredMimeType: file.type,
      sizeBytes: bytes.length,
      bytes,
    });

    const objectKey = buildObjectKey(membership.hostelId, kindValue, mimeType);
    await putPrivateObject({ objectKey, bytes, mimeType });

    const checksum = createHash("sha256").update(bytes).digest("hex");
    const context = await requestContext();

    const stored = await prisma.$transaction(async (tx) => {
      const record = await tx.storedObject.create({
        data: {
          hostelId: membership.hostelId,
          kind: kindValue,
          objectKey,
          bucket: process.env.MINIO_BUCKET_PRIVATE ?? "",
          mimeType,
          sizeBytes: bytes.length,
          checksumSha256: checksum,
          // Kept for staff recognition only; it is never used to build the storage key.
          originalFilename: file.name.slice(0, 120),
          uploadedByUserId: user.id,
        },
        select: { id: true, kind: true, sizeBytes: true, mimeType: true },
      });

      await recordAudit(
        {
          action: "document.uploaded",
          entityType: "StoredObject",
          entityId: record.id,
          hostelId: membership.hostelId,
          actorUserId: user.id,
          summary: `Uploaded a ${kindValue.toLowerCase().replace(/_/g, " ")}`,
          metadata: { kind: kindValue, sizeBytes: bytes.length, mimeType },
          ...context,
        },
        tx,
      );

      return record;
    });

    return NextResponse.json({ document: stored }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const status = statusForError(error);
    if (status === 500) {
      // Log the failure, never the request body: it holds the file the resident uploaded.
      console.error("Upload failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refused" },
      { status },
    );
  }
}
