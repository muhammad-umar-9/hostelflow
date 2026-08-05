/**
 * Upload validation.
 *
 * A filename extension and a `Content-Type` header both come from whoever is uploading,
 * so neither is evidence of anything. The first bytes of the file are. Every upload is
 * checked against a magic-byte signature and refused when the contents disagree with the
 * declared type.
 *
 * Pure and dependency-free so it can be unit tested; lib/server/storage.ts supplies the
 * configured size limit and performs the actual write.
 */

export class UploadValidationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadValidationError";
    this.status = status;
  }
}

/** MIME types accepted for upload, and the extension used for their object key. */
export const ALLOWED_UPLOAD_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

const FILE_SIGNATURES: { mime: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    // FF D8 FF
    mime: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    // 89 P N G CR
    mime: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d,
  },
  {
    // R I F F .... W E B P
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    // % P D F -
    mime: "application/pdf",
    test: (b) =>
      b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d,
  },
];

/**
 * Returns the MIME type the bytes actually are, or null when they match nothing allowed.
 * Never consults the declared type.
 */
export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  return FILE_SIGNATURES.find((signature) => signature.test(bytes))?.mime ?? null;
}

export interface UploadCandidate {
  declaredMimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  maxBytes: number;
}

/**
 * Validates an upload before a byte of it reaches storage: non-empty, within the size
 * limit, an allowed type, and contents that match the type claimed.
 */
export function assertAllowedUpload(candidate: UploadCandidate): { mimeType: string } {
  if (candidate.sizeBytes <= 0) {
    throw new UploadValidationError("The file is empty");
  }
  if (candidate.sizeBytes > candidate.maxBytes) {
    const limitMb = Math.floor(candidate.maxBytes / (1024 * 1024));
    throw new UploadValidationError(
      `The file is larger than the ${limitMb} MB limit`,
      413,
    );
  }
  if (!ALLOWED_UPLOAD_TYPES.has(candidate.declaredMimeType)) {
    throw new UploadValidationError("Upload a JPG, PNG, WebP or PDF file");
  }

  const detected = detectMimeType(candidate.bytes);
  if (!detected) {
    throw new UploadValidationError("That file is not a readable image or PDF");
  }
  if (detected !== candidate.declaredMimeType) {
    // Declared one thing, contents say another. Refuse rather than guess which is right.
    throw new UploadValidationError("The file contents do not match its type");
  }

  return { mimeType: detected };
}

/** The extension used when building an object key for a validated MIME type. */
export function extensionFor(mimeType: string): string {
  return ALLOWED_UPLOAD_TYPES.get(mimeType) ?? "bin";
}
