import "server-only";

import { headers } from "next/headers";
import { redact, redactText } from "@/lib/domain/redaction";
import type { DbClient } from "./db";
import { prisma } from "./db";

/**
 * The audit trail.
 *
 * Two properties the rest of the system relies on:
 *
 *   1. **It commits with the thing it describes.** `recordAudit` takes the caller's
 *      transaction client, so "payment verified" and the audit row for it either both
 *      land or both roll back. An audit written after the transaction can be lost
 *      exactly when it matters most.
 *   2. **It never stores a secret.** Summaries and metadata pass through `redact` first,
 *      which removes anything CNIC-shaped, token-shaped or signed-URL-shaped. The
 *      specification forbids CNIC numbers, passwords, tokens and signed URLs in logs, and
 *      the cheapest way to keep that promise is to make it impossible to write them.
 *
 * The table itself is append-only at the database level: a trigger refuses UPDATE and
 * DELETE for every role, including this application's own. See the init migration.
 */

/** Dotted action names. Kept as a union so a typo does not silently create a new action. */
export type AuditAction =
  | "auth.signed_in"
  | "auth.signed_out"
  | "auth.sign_in_failed"
  | "user.created"
  | "user.disabled"
  | "membership.granted"
  | "membership.revoked"
  | "resident.created"
  | "resident.updated"
  | "resident.cnic_revealed"
  | "document.uploaded"
  | "document.viewed"
  | "document.deleted"
  | "bed.allocated"
  | "bed.moved"
  | "bed.released"
  | "bed.held"
  | "bed.status_changed"
  | "admission.confirmed"
  | "admission.cancelled"
  | "invoice.issued"
  | "invoice.voided"
  | "payment.recorded"
  | "payment.verified"
  | "payment.reversed"
  | "proof.submitted"
  | "proof.approved"
  | "proof.rejected"
  | "proof.clarification_requested"
  | "police.status_changed"
  | "checkout.started"
  | "checkout.approved"
  | "checkout.completed"
  | "deposit.entry_recorded"
  | "settings.updated";

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  hostelId?: string | null;
  actorUserId?: string | null;
  /** One short human-readable line. Redacted before it is stored. */
  summary?: string | null;
  /** Structured detail. Redacted recursively before it is stored. */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes one audit row.
 *
 * Pass `client` when inside a transaction so the audit row shares its fate. Without it
 * the row is written on the shared connection and can outlive a rolled-back operation.
 */
export async function recordAudit(
  entry: AuditEntry,
  client: DbClient = prisma,
): Promise<void> {
  const metadata = entry.metadata ? redact(entry.metadata) : undefined;

  await client.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      hostelId: entry.hostelId ?? null,
      actorUserId: entry.actorUserId ?? null,
      summary: entry.summary ? redactText(entry.summary) : null,
      metadata: (metadata as never) ?? undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/**
 * Best-effort client details for an audited request.
 *
 * `x-forwarded-for` is only trustworthy because Caddy is the single public entry point
 * and rewrites it; it would be spoofable if the app were exposed directly.
 */
export async function requestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  return {
    ipAddress: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null,
    userAgent: headerList.get("user-agent"),
  };
}

/**
 * The same details, but usable outside a request.
 *
 * `headers()` throws when there is no request scope, so any audited operation that called
 * `requestContext()` directly could only ever run inside an HTTP request — not from the
 * seed, the owner bootstrap, a future scheduled job, or a test. Those callers still need
 * to write audit rows; they simply have no client address to attach.
 */
export async function optionalRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    return await requestContext();
  } catch (error) {
    // Only "there is no request here" is tolerated.
    //
    // A bare catch also swallowed Next's DynamicServerError, which `headers()` throws
    // during static generation precisely so the framework knows to render that route
    // dynamically. Absorbing it would leave a Server Component that audits a read
    // silently prerendered as static — served with somebody else's data baked in. It also
    // hid genuine header failures behind a shrug.
    if (isMissingRequestScope(error)) return { ipAddress: null, userAgent: null };
    throw error;
  }
}

/**
 * True when `headers()` failed because nothing is serving a request — a script, a
 * scheduled job or a test — rather than because Next is signalling a dynamic bailout.
 */
function isMissingRequestScope(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Next marks the static-generation bailout with a digest; that one must propagate.
  const digest = (error as Error & { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith("DYNAMIC_SERVER_USAGE")) {
    return false;
  }
  if (error.name === "DynamicServerError") return false;

  return /outside a request scope/i.test(error.message);
}
