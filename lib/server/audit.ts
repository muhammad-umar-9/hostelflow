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
 * Reading the FIRST entry of `x-forwarded-for` was safe only while Caddy was the single
 * public entry point, rewriting the header wholesale. Behind Cloudflare it is not:
 * Cloudflare *appends* the real client address to whatever the caller already sent, so a
 * request carrying `X-Forwarded-For: 1.2.3.4` arrives as `1.2.3.4, <real ip>` and the
 * first entry is a value the attacker chose. Audit rows naming an address of the
 * attacker's choosing are worse than audit rows naming none.
 *
 * `CF-Connecting-IP` is set by Cloudflare and overwritten on every request, so a client
 * cannot forge it. It is preferred; otherwise the LAST entry of `x-forwarded-for` is
 * taken, that being the one appended by the proxy nearest to us rather than the one the
 * client supplied.
 */
export async function requestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerList = await headers();

  return {
    ipAddress: clientAddress(headerList),
    userAgent: headerList.get("user-agent"),
  };
}

/**
 * The client's address, read from the one header the deployed front end actually controls.
 *
 * Trying each candidate header in turn is what makes this dangerous, and an earlier
 * version did exactly that. Every one of these is a plain request header: whichever the
 * front end does not overwrite, a client can simply send. Preferring `CF-Connecting-IP`
 * unconditionally meant that under the Caddy profile — where nothing strips it — a request
 * carrying `CF-Connecting-IP: 8.8.8.8` put an attacker-chosen address into every audit
 * row. That is the same bug as trusting the first `X-Forwarded-For` entry, moved one
 * deployment over.
 *
 * So the front end is declared in configuration rather than sniffed, and only its header
 * is read. An unrecognised or absent setting records nothing, because an audit trail with
 * no address is honest and one with a forged address is not.
 */
function clientAddress(headerList: Headers): string | null {
  const trusted = process.env.TRUSTED_PROXY;

  if (trusted === "cloudflare") {
    // Cloudflare overwrites this on every request, so a client cannot forge it.
    return headerList.get("cf-connecting-ip")?.trim() || null;
  }

  if (trusted === "reverse-proxy") {
    // Caddy replaces X-Real-IP and X-Forwarded-For with the peer address it sees. The
    // last XFF entry is the one it appended; earlier entries came from the caller.
    const realIp = headerList.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = headerList
      .get("x-forwarded-for")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return forwarded?.length ? (forwarded[forwarded.length - 1] ?? null) : null;
  }

  // No declared front end — a local run, or a misconfiguration. Recording nothing beats
  // recording something a caller chose.
  return null;
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
