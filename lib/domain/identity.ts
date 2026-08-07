/**
 * Pakistani CNIC and mobile-number handling.
 *
 * Two rules drive the design:
 *
 *   1. **Store normalized, display formatted.** A CNIC is stored as 13 bare digits so
 *      comparison and uniqueness work regardless of how it was typed; it is shown as
 *      `35202-1234567-1`. A mobile number is stored as `03XXXXXXXXX` and shown as
 *      `0300 1234567`.
 *   2. **Mask by default.** `maskCnic` is what belongs in lists, logs, audit summaries and
 *      anything that leaves the server. The complete value is revealed only on the
 *      protected resident-detail screen, to staff who are authorized for it.
 *
 * Pure functions, safe on both the server and the client.
 */

/** CNIC as typed with dashes: 5 digits, 7 digits, 1 check digit. */
export const CNIC_DISPLAY_REGEX = /^\d{5}-\d{7}-\d$/;
/** CNIC as stored: 13 bare digits. */
export const CNIC_NORMALIZED_REGEX = /^\d{13}$/;
/** Mobile as stored: 03 followed by 9 digits. */
export const MOBILE_NORMALIZED_REGEX = /^03\d{9}$/;

export class IdentityError extends Error {
  /** Bad input, not a server fault — see the note on MoneyError. */
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

/**
 * Normalizes a CNIC or B-Form number to 13 digits.
 * Accepts `35202-1234567-1`, `3520212345671`, and copies with stray spaces.
 */
export function normalizeCnic(input: string): string {
  const digits = (input ?? "").replace(/[\s-]/g, "");
  if (!CNIC_NORMALIZED_REGEX.test(digits)) {
    throw new IdentityError(
      "Enter a 13-digit CNIC or B-Form number, like 35202-1234567-1",
    );
  }
  return digits;
}

/** Normalizes without throwing. Returns null when the value is not a valid CNIC. */
export function tryNormalizeCnic(input: string): string | null {
  try {
    return normalizeCnic(input);
  } catch {
    return null;
  }
}

/** 13 stored digits back to `35202-1234567-1` for display. */
export function formatCnic(normalized: string): string {
  if (!CNIC_NORMALIZED_REGEX.test(normalized)) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5, 12)}-${normalized.slice(12)}`;
}

/**
 * `35202-*****67-1`. The default representation everywhere except the protected
 * resident-detail screen. Keeps enough digits for a human to recognize the right person
 * without exposing the identity number.
 */
export function maskCnic(value: string): string {
  const normalized = tryNormalizeCnic(value);
  if (!normalized) return "*****";

  const area = normalized.slice(0, 5);
  const tail = normalized.slice(10, 12);
  const check = normalized.slice(12);
  return `${area}-*****${tail}-${check}`;
}

/**
 * Normalizes a Pakistani mobile number to `03XXXXXXXXX`.
 * Accepts `0300 1234567`, `03001234567`, `+923001234567`, `0092 300 1234567`
 * and `300 1234567`.
 */
export function normalizeMobile(input: string): string {
  let digits = (input ?? "").replace(/[\s()-]/g, "");

  if (digits.startsWith("+92")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("0092")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("92") && digits.length === 12)
    digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("3") && digits.length === 10) digits = `0${digits}`;

  if (!MOBILE_NORMALIZED_REGEX.test(digits)) {
    throw new IdentityError("Enter a mobile number like 0300 1234567 or +92 300 1234567");
  }
  return digits;
}

/** Normalizes without throwing. Returns null when the value is not a valid mobile. */
export function tryNormalizeMobile(input: string): string | null {
  try {
    return normalizeMobile(input);
  } catch {
    return null;
  }
}

/** `03001234567` to `0300 1234567` for display. */
export function formatMobile(normalized: string): string {
  if (!MOBILE_NORMALIZED_REGEX.test(normalized)) return normalized;
  return `${normalized.slice(0, 4)} ${normalized.slice(4)}`;
}

/** `+923001234567`, for WhatsApp deep links. */
export function toInternationalMobile(normalized: string): string {
  if (!MOBILE_NORMALIZED_REGEX.test(normalized)) {
    throw new IdentityError(
      "Cannot build an international number from an invalid mobile",
    );
  }
  return `+92${normalized.slice(1)}`;
}

/**
 * Builds a WhatsApp deep link. The message is URL-encoded, and the number is validated
 * first so a malformed value cannot produce a link that silently goes nowhere.
 */
export function whatsAppLink(normalizedMobile: string, message?: string): string {
  const international = toInternationalMobile(normalizedMobile).replace("+", "");
  const base = `https://wa.me/${international}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** `Ali Raza` to `AR`, for the avatar chips. */
export function initialsOf(fullName: string): string {
  return (fullName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
