import "server-only";

import { randomUUID } from "node:crypto";
import { Client as MinioClient } from "minio";
import { assertAllowedUpload, extensionFor } from "@/lib/domain/uploads";
import type { StoredObjectKind } from "@/lib/generated/prisma/enums";
import { serverEnv } from "./env";

/**
 * Private object storage.
 *
 * Everything a resident hands over — their photograph, both sides of their CNIC, their
 * guardian's CNIC, payment screenshots, police acknowledgements, damage photographs — goes
 * into one private MinIO bucket. The bucket is never public. PostgreSQL stores only the
 * metadata and the key; the bytes never touch the database.
 *
 * Three rules enforced here:
 *
 *   1. **Keys carry no personal data.** A key is `hostel/<id>/<kind>/<uuid>.<ext>`. No
 *      CNIC, no name, no phone number, no guessable sequence. Object keys leak through
 *      logs and error messages far more often than anyone expects.
 *   2. **Content is checked by its bytes, not its name.** `verifyFileSignature` reads the
 *      magic bytes. A `.jpg` extension on a file whose first bytes say otherwise is
 *      refused.
 *   3. **Access is short-lived.** Signed URLs expire in `SIGNED_URL_TTL_SECONDS`, two
 *      minutes by default, and are never written to a log.
 */

export interface UploadValidationInput {
  declaredMimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

export class StorageError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

let cachedClient: MinioClient | null = null;

export function storageClient(): MinioClient {
  if (cachedClient) return cachedClient;
  const env = serverEnv();

  cachedClient = new MinioClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
  });
  return cachedClient;
}

export function privateBucket(): string {
  return serverEnv().MINIO_BUCKET_PRIVATE;
}

/**
 * Creates the private bucket if it is missing. Idempotent, so the deployment entrypoint
 * can call it on every start. It never sets a public policy — the bucket's default of
 * "no anonymous access" is exactly what is wanted, and MinIO buckets are private unless
 * a policy says otherwise.
 */
export async function ensurePrivateBucket(): Promise<{
  bucket: string;
  created: boolean;
}> {
  const client = storageClient();
  const bucket = privateBucket();

  const exists = await client.bucketExists(bucket);
  if (exists) return { bucket, created: false };

  await client.makeBucket(bucket);
  return { bucket, created: true };
}

/**
 * Validates an upload against the configured size limit.
 *
 * The type and signature rules live in lib/domain/uploads.ts, which is pure and unit
 * tested; this wrapper only supplies `MAX_UPLOAD_BYTES` from the environment.
 */
export function validateUpload(input: UploadValidationInput): { mimeType: string } {
  return assertAllowedUpload({
    declaredMimeType: input.declaredMimeType,
    sizeBytes: input.sizeBytes,
    bytes: input.bytes,
    maxBytes: serverEnv().MAX_UPLOAD_BYTES,
  });
}

/**
 * Builds a storage key. Randomized, hostel-partitioned, and free of personal data:
 * `hostel/<hostelId>/<kind>/<uuid>.<ext>`.
 *
 * The resident id is deliberately absent. Keys turn up in logs and error traces, and a
 * key that identifies a person is a leak waiting to happen.
 */
export function buildObjectKey(
  hostelId: string,
  kind: StoredObjectKind,
  mimeType: string,
): string {
  const extension = extensionFor(mimeType);
  const safeHostel = hostelId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `hostel/${safeHostel}/${kind.toLowerCase()}/${randomUUID()}.${extension}`;
}

export interface PutObjectInput {
  objectKey: string;
  bytes: Uint8Array;
  mimeType: string;
}

export async function putPrivateObject(input: PutObjectInput): Promise<void> {
  const client = storageClient();
  await client.putObject(
    privateBucket(),
    input.objectKey,
    Buffer.from(input.bytes),
    input.bytes.length,
    { "Content-Type": input.mimeType },
  );
}

/** Streams an object back. The caller must have authorized the read first. */
export async function getPrivateObjectStream(
  objectKey: string,
): Promise<NodeJS.ReadableStream> {
  const client = storageClient();
  return client.getObject(privateBucket(), objectKey);
}

/**
 * A short-lived signed URL.
 *
 * Never log the return value: it is a bearer credential for that object until it expires.
 * Prefer streaming through the protected route when the file is small, and reserve signed
 * URLs for cases where proxying the bytes would be wasteful.
 */
export async function signedObjectUrl(objectKey: string): Promise<string> {
  const client = storageClient();
  const ttl = serverEnv().SIGNED_URL_TTL_SECONDS;
  return client.presignedGetObject(privateBucket(), objectKey, ttl);
}

export async function removePrivateObject(objectKey: string): Promise<void> {
  const client = storageClient();
  await client.removeObject(privateBucket(), objectKey);
}

/** True when MinIO answers. Used by the health check, never in a request path. */
export async function storageReachable(): Promise<boolean> {
  try {
    await storageClient().bucketExists(privateBucket());
    return true;
  } catch {
    return false;
  }
}
