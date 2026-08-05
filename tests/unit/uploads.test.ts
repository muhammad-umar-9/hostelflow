import { describe, expect, it } from "vitest";
import {
  UploadValidationError,
  assertAllowedUpload,
  detectMimeType,
  extensionFor,
} from "@/lib/domain/uploads";

/**
 * Uploads are the route by which a CNIC image, and anything else, enters the system.
 * These tests pin the rule that matters: the bytes decide the type, not the filename and
 * not the Content-Type header.
 */

const MAX = 8 * 1024 * 1024;

/** Builds a buffer whose leading bytes are a real file signature. */
function fileWith(signature: number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(signature, 0);
  return bytes;
}

const JPEG = fileWith([0xff, 0xd8, 0xff, 0xe0]);
const PNG = fileWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = fileWith([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const WEBP = (() => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return bytes;
})();

describe("detecting a type from the bytes", () => {
  it("recognizes the allowed formats", () => {
    expect(detectMimeType(JPEG)).toBe("image/jpeg");
    expect(detectMimeType(PNG)).toBe("image/png");
    expect(detectMimeType(PDF)).toBe("application/pdf");
    expect(detectMimeType(WEBP)).toBe("image/webp");
  });

  it("returns null for anything else", () => {
    expect(detectMimeType(fileWith([0x4d, 0x5a]))).toBeNull(); // Windows executable
    expect(detectMimeType(fileWith([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip
  });

  it("returns null for a file too short to identify", () => {
    expect(detectMimeType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("accepting an upload", () => {
  it("accepts a genuine JPEG declared as one", () => {
    const result = assertAllowedUpload({
      declaredMimeType: "image/jpeg",
      sizeBytes: JPEG.length,
      bytes: JPEG,
      maxBytes: MAX,
    });
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("refuses an executable renamed to look like an image", () => {
    const executable = fileWith([0x4d, 0x5a, 0x90, 0x00]);
    expect(() =>
      assertAllowedUpload({
        declaredMimeType: "image/jpeg",
        sizeBytes: executable.length,
        bytes: executable,
        maxBytes: MAX,
      }),
    ).toThrow(UploadValidationError);
  });

  it("refuses a PDF declared as a JPEG", () => {
    expect(() =>
      assertAllowedUpload({
        declaredMimeType: "image/jpeg",
        sizeBytes: PDF.length,
        bytes: PDF,
        maxBytes: MAX,
      }),
    ).toThrow(/do not match/i);
  });

  it("refuses a type that is not on the list", () => {
    expect(() =>
      assertAllowedUpload({
        declaredMimeType: "image/svg+xml",
        sizeBytes: JPEG.length,
        bytes: JPEG,
        maxBytes: MAX,
      }),
    ).toThrow(/JPG, PNG, WebP or PDF/);
  });

  it("refuses an empty file", () => {
    expect(() =>
      assertAllowedUpload({
        declaredMimeType: "image/jpeg",
        sizeBytes: 0,
        bytes: new Uint8Array(0),
        maxBytes: MAX,
      }),
    ).toThrow(/empty/i);
  });

  it("refuses a file over the limit, with a 413", () => {
    try {
      assertAllowedUpload({
        declaredMimeType: "image/jpeg",
        sizeBytes: MAX + 1,
        bytes: JPEG,
        maxBytes: MAX,
      });
      expect.unreachable("oversized upload should have been refused");
    } catch (error) {
      expect(error).toBeInstanceOf(UploadValidationError);
      expect((error as UploadValidationError).status).toBe(413);
    }
  });
});

describe("object key extensions", () => {
  it("maps each allowed type", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("application/pdf")).toBe("pdf");
  });

  it("falls back rather than throwing on an unknown type", () => {
    expect(extensionFor("application/octet-stream")).toBe("bin");
  });
});
