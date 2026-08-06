import { NextResponse } from "next/server";
import { UploadValidationError } from "@/lib/domain/uploads";
import { MembershipRole, StoredObjectKind } from "@/lib/generated/prisma/enums";
import { recordAudit, requestContext } from "@/lib/server/audit";
import {
  hasPermission,
  requireMembership,
  statusForError,
  AuthorizationError,
} from "@/lib/server/authz";
import { prisma } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import {
  StorageError,
  buildObjectKey,
  privateBucket,
  putPrivateObject,
  removePrivateObject,
  validateUpload,
} from "@/lib/server/storage";
import { createHash } from "node:crypto";

/**
 * Protected upload.
 *
 * Order matters: authenticate, read a bounded body, authorize the specific document kind,
 * prove the bytes are what they claim by their signature, store, then record. Nothing
 * reaches MinIO before all of that has passed.
 *
 * The response returns only the database id. The object key is an internal detail;
 * handing it to the browser invites someone to try constructing their own URLs.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Documents staff may attach to a resident's file. */
const STAFF_UPLOADABLE_KINDS = new Set<StoredObjectKind>([
  StoredObjectKind.RESIDENT_PHOTO,
  StoredObjectKind.CNIC_FRONT,
  StoredObjectKind.CNIC_BACK,
  StoredObjectKind.GUARDIAN_CNIC,
  StoredObjectKind.STUDENT_CARD,
  StoredObjectKind.PAYMENT_PROOF,
  StoredObjectKind.POLICE_ACKNOWLEDGEMENT,
  StoredObjectKind.DAMAGE_PHOTO,
]);

/**
 * The only thing a resident may upload: evidence of their own payment.
 *
 * A resident must be able to submit a payment proof — it is the point of the companion
 * portal — so the route cannot be staff-only. Everything else about their record is
 * written by staff.
 */
const RESIDENT_UPLOADABLE_KINDS = new Set<StoredObjectKind>([
  StoredObjectKind.PAYMENT_PROOF,
]);

function isUploadableKind(value: string): value is StoredObjectKind {
  return STAFF_UPLOADABLE_KINDS.has(value as StoredObjectKind);
}

/**
 * Slack allowed on top of the file limit for multipart boundaries, field names and
 * headers, so a file exactly at the limit is not rejected by its own envelope.
 */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Reads the request body, refusing to buffer more than `limitBytes`.
 *
 * Checking `Content-Length` is not enough and was the bug here before: a chunked request
 * sends no such header, and a junk value parses to NaN. Both slipped past the check and
 * `formData()` then buffered the whole body into memory regardless. The header is
 * attacker-controlled; the number of bytes actually read is not, so the limit is enforced
 * against the stream itself and the connection is cancelled the moment it is exceeded.
 */
async function readLimitedBody(
  request: Request,
  limitBytes: number,
  // Uint8Array is generic over its backing buffer since TypeScript 5.7, and `BodyInit`
  // accepts only the ArrayBuffer-backed form.
): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) throw new UploadValidationError("The request had no body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > limitBytes) {
      // Stop pulling bytes rather than draining an unbounded upload politely.
      await reader.cancel();
      const limitMb = Math.floor(serverEnv().MAX_UPLOAD_BYTES / (1024 * 1024));
      throw new UploadValidationError(
        `The file is larger than the ${limitMb} MB limit`,
        413,
      );
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request) {
  let storedObjectKey: string | null = null;

  try {
    // Authentication first, so an anonymous caller cannot make the server read anything.
    const { user, membership } = await requireMembership();

    const maxBytes = serverEnv().MAX_UPLOAD_BYTES;
    const raw = await readLimitedBody(request, maxBytes + MULTIPART_OVERHEAD);

    const form = await new Response(raw, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();

    const file = form.get("file");
    const kindValue = String(form.get("kind") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
    }
    if (!isUploadableKind(kindValue)) {
      return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
    }

    // Authorization depends on the kind, so it happens once the kind is known.
    if (membership.role === MembershipRole.RESIDENT) {
      if (!RESIDENT_UPLOADABLE_KINDS.has(kindValue)) throw new AuthorizationError();
    } else if (!hasPermission(membership, "residents.write")) {
      throw new AuthorizationError();
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { mimeType } = validateUpload({
      declaredMimeType: file.type,
      sizeBytes: bytes.length,
      bytes,
    });

    const objectKey = buildObjectKey(membership.hostelId, kindValue, mimeType);
    await putPrivateObject({ objectKey, bytes, mimeType });
    // Remembered so the catch block can remove it if the transaction below fails. An
    // object with no metadata row is unreachable through the application and has no
    // deletion path, and these objects are CNIC images.
    storedObjectKey = objectKey;

    const checksum = createHash("sha256").update(bytes).digest("hex");
    const context = await requestContext();

    const stored = await prisma.$transaction(async (tx) => {
      const record = await tx.storedObject.create({
        data: {
          hostelId: membership.hostelId,
          kind: kindValue,
          objectKey,
          // The same source the write used. Reading process.env directly here meant the
          // recorded bucket and the written bucket agreed only by coincidence.
          bucket: privateBucket(),
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

    // Past this point the object and its row both exist, so nothing is orphaned.
    storedObjectKey = null;

    return NextResponse.json({ document: stored }, { status: 201 });
  } catch (error) {
    // Compensating delete. The bytes reached MinIO before the transaction ran, so a
    // failure after the upload leaves an object no row points at — invisible to the
    // application, undeletable through it, and holding someone's CNIC.
    if (storedObjectKey) {
      try {
        await removePrivateObject(storedObjectKey);
      } catch (cleanupError) {
        // Worth knowing about: it means an orphan really is sitting in the bucket. The
        // key is safe to log because it contains no personal data by construction.
        console.error("Failed to remove an orphaned upload", {
          objectKey: storedObjectKey,
          message: cleanupError instanceof Error ? cleanupError.message : "unknown",
        });
      }
    }

    // Validation failures carry a message written for the person uploading, and a status
    // that is not 500. UploadValidationError is what the validator actually throws;
    // StorageError covers a genuine MinIO failure.
    if (error instanceof UploadValidationError || error instanceof StorageError) {
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
