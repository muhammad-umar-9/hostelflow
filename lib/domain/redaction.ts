/**
 * Redaction for anything that gets written down: audit summaries, audit metadata and
 * server logs.
 *
 * The specification forbids CNIC numbers, passwords, tokens and signed URLs from ever
 * appearing in a log. The cheapest way to keep that promise is to make writing them
 * impossible rather than to rely on every future call site remembering.
 *
 * Pure and dependency-free so it can be unit tested directly; the server-side audit
 * writer in lib/server/audit.ts applies it before every insert.
 */

/** 13 consecutive digits, or the dashed CNIC form. */
const CNIC_PATTERN = /\b\d{5}-?\d{7}-?\d\b/g;
/** Any URL carrying a signature, which is what a presigned object URL looks like. */
const SIGNED_URL_PATTERN = /https?:\/\/\S*[?&](X-Amz-Signature|signature|token)=\S*/gi;
/** Long opaque strings: session tokens, API keys, bearer tokens. */
const TOKEN_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

/** Field names whose value is dropped outright, whatever it happens to look like. */
const FORBIDDEN_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
  "authorization",
  "cookie",
  "signedurl",
  "presignedurl",
  "cnic",
  "cnicnormalized",
  "guardiancnic",
]);

/** Masks CNICs, signed URLs and long tokens in free text. */
export function redactText(value: string): string {
  return value
    .replace(SIGNED_URL_PATTERN, "[signed-url-redacted]")
    .replace(CNIC_PATTERN, (match) => {
      const digits = match.replace(/-/g, "");
      return digits.length === 13 ? `${digits.slice(0, 5)}-*****-[redacted]` : match;
    })
    .replace(TOKEN_PATTERN, "[redacted]");
}

/**
 * Recursively redacts a metadata value: forbidden keys are replaced, strings are
 * scrubbed, everything else passes through. Depth and array length are capped so a
 * deeply nested or enormous object cannot stall the request that is being audited.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = FORBIDDEN_KEYS.has(key.toLowerCase())
        ? "[redacted]"
        : redact(nested, depth + 1);
    }
    return result;
  }

  return "[unserializable]";
}
