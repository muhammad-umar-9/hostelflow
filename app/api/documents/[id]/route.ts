import { NextResponse } from "next/server";
import { MembershipRole, StoredObjectKind } from "@/lib/generated/prisma/enums";
import { recordAudit, requestContext } from "@/lib/server/audit";
import {
  hasPermission,
  requireMembership,
  statusForError,
  type Permission,
} from "@/lib/server/authz";
import { prisma } from "@/lib/server/db";
import { getPrivateObjectStream } from "@/lib/server/storage";
import { Readable } from "node:stream";

/**
 * Protected download for a private object.
 *
 * The bytes are proxied through this route rather than handed out as a signed URL. That
 * costs a little bandwidth and buys three things: the read is authorized per request, the
 * access is recorded, and no URL exists that keeps working after the reader's session
 * ends or their access is revoked.
 *
 * A resident may open only files that belong to them. Staff may open files belonging to
 * their own hostel. Anything else is reported as missing rather than forbidden, so this
 * route cannot be used to discover which document ids exist.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Documents that are an identity number in image form. */
const CNIC_KINDS = new Set<StoredObjectKind>([
  StoredObjectKind.CNIC_FRONT,
  StoredObjectKind.CNIC_BACK,
  StoredObjectKind.GUARDIAN_CNIC,
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user, membership } = await requireMembership();

    const object = await prisma.storedObject.findFirst({
      where: { id, hostelId: membership.hostelId, deletedAt: null },
      select: {
        id: true,
        objectKey: true,
        mimeType: true,
        kind: true,
        hostelId: true,
        // Every relation that records a resident owner. Anything missing here means the
        // rightful owner is refused their own file.
        residentDocument: { select: { residentId: true } },
        paymentProofs: { select: { residentId: true } },
        receipts: { select: { residentId: true } },
        policeDocuments: { select: { residentId: true } },
        damageDeductions: { select: { checkout: { select: { residentId: true } } } },
      },
    });

    if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Staff need a permission, not merely a membership. Without this a manager whose
    // owner has explicitly set {"residents.read": false} could still stream every CNIC
    // image in the hostel, and the permission matrix would be decoration.
    if (membership.role !== MembershipRole.RESIDENT) {
      const required: Permission = CNIC_KINDS.has(object.kind)
        ? // A scan of a CNIC is the identity number itself, so it sits behind the same
          // permission that governs revealing the number on screen.
          "residents.viewFullCnic"
        : "residents.read";

      if (!hasPermission(membership, required)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (membership.role === MembershipRole.RESIDENT) {
      const self = await prisma.resident.findFirst({
        where: { userId: user.id, hostelId: membership.hostelId },
        select: { id: true },
      });

      const ownerIds = new Set(
        [
          object.residentDocument?.residentId,
          ...object.paymentProofs.map((proof) => proof.residentId),
          ...object.receipts.map((receipt) => receipt.residentId),
          ...object.policeDocuments.map((police) => police.residentId),
          ...object.damageDeductions.map((deduction) => deduction.checkout?.residentId),
        ].filter((value): value is string => Boolean(value)),
      );

      // No resident owner recorded means it is a staff document; a resident has no claim.
      if (!self || ownerIds.size === 0 || !ownerIds.has(self.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const context = await requestContext();

    // Recorded before streaming, so an aborted download is still an access that happened.
    await prisma.$transaction(async (tx) => {
      await tx.documentAccessLog.create({
        data: {
          objectId: object.id,
          userId: user.id,
          action: "download",
          ipAddress: context.ipAddress,
        },
      });

      await recordAudit(
        {
          action: "document.viewed",
          entityType: "StoredObject",
          entityId: object.id,
          hostelId: membership.hostelId,
          actorUserId: user.id,
          summary: `Opened a ${object.kind.toLowerCase().replace(/_/g, " ")}`,
          metadata: { kind: object.kind },
          ...context,
        },
        tx,
      );
    });

    const stream = await getPrivateObjectStream(object.objectKey);

    return new NextResponse(Readable.toWeb(Readable.from(stream)) as ReadableStream, {
      headers: {
        "Content-Type": object.mimeType,
        // `inline` so staff can view a CNIC without downloading a copy to the desk PC.
        "Content-Disposition": "inline",
        // Private documents must never sit in a shared or browser cache.
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = statusForError(error);
    if (status === 500) {
      console.error("Document read failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return NextResponse.json({ error: "Could not open the document" }, { status: 500 });
    }
    return NextResponse.json({ error: "Not found" }, { status });
  }
}
