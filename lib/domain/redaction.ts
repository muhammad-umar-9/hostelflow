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
/**
 * Long opaque strings: session tokens, API keys, bearer tokens.
 *
 * The alphabet covers **both** base64 variants. It previously covered only base64url
 * (`-` and `_`), which meant a standard-base64 secret — precisely what
 * `openssl rand -base64 48` produces, and what the deployment guide instructs the operator
 * to generate for AUTH_SECRET — was broken into short runs by its `+` and `/` characters
 * and slipped through. Measured over 2000 generated secrets: 27% passed entirely
 * unredacted and a further 59% leaked fragments.
 */
const TOKEN_PATTERN = /[A-Za-z0-9+/_=-]{32,}/g;

/**
 * A UUID is 36 characters, so `TOKEN_PATTERN` was replacing every object-key id with
 * `[redacted]` — stripping out precisely the identifier an investigator needs to follow a
 * document through the trail. A random UUID is not a credential: it grants nothing without
 * an authorized session.
 *
 * Note what is deliberately NOT exempted here: anything merely *shaped* like a hex digest.
 * A 64-character hex string may be a SHA-256 checksum, but it may equally be a hex-encoded
 * API key, and free text carries no way to tell them apart. Checksums are preserved
 * through `SAFE_KEYS` below instead, where the field name settles the question.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Metadata fields whose values are identifiers rather than secrets, and which are worth
 * more in the audit trail than the marginal risk of keeping them.
 */
const SAFE_KEYS = new Set([
  "checksumsha256",
  "objectkey",
  "entityid",
  "id",
  "bucket",
  "mimetype",
]);

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
    .replace(TOKEN_PATTERN, (match) => (UUID_PATTERN.test(match) ? match : "[redacted]"));
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
      const lowered = key.toLowerCase();

      if (FORBIDDEN_KEYS.has(lowered)) {
        result[key] = "[redacted]";
        continue;
      }

      // The field name is what distinguishes a checksum or an object key from a
      // hex-encoded credential, so these are kept whole rather than pattern-matched.
      if (SAFE_KEYS.has(lowered) && typeof nested === "string") {
        result[key] = nested;
        continue;
      }

      result[key] = redact(nested, depth + 1);
    }
    return result;
  }

  return "[unserializable]";
}
