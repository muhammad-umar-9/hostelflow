/**
 * Creates the private MinIO bucket if it does not exist, and verifies it is actually
 * private.
 *
 * Idempotent, so the deployment entrypoint runs it on every boot. It never applies a
 * bucket policy: a new MinIO bucket allows no anonymous access, and that is exactly what
 * CNIC images and payment proofs require. The only way to read an object is through the
 * application's authorized download route.
 *
 * This script's privacy check is load-bearing, so it fails closed. If it cannot prove the
 * bucket has no policy, it says so and exits non-zero rather than printing reassurance it
 * has not earned.
 *
 *   docker compose exec app npm run storage:init
 */
import { Client as MinioClient } from "minio";

const required = [
  "MINIO_ENDPOINT",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "MINIO_BUCKET_PRIVATE",
] as const;

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

/**
 * Parsed the same way lib/server/env.ts parses them. `Number("")` is 0 and `Number("9O0")`
 * is NaN; the MinIO client turns either into "no port given" and silently falls back to
 * port 80, so a blank or mistyped value would have this script create the bucket on
 * whatever answers port 80. Refuse instead.
 */
function requirePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 9000;

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`MINIO_PORT must be a port number, received "${raw}"`);
    process.exit(1);
  }
  return port;
}

/** Only the exact strings the application's own schema accepts. */
function requireBoolean(name: string, raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  if (raw !== "true" && raw !== "false") {
    console.error(`${name} must be "true" or "false", received "${raw}"`);
    process.exit(1);
  }
  return raw === "true";
}

const bucket = process.env.MINIO_BUCKET_PRIVATE as string;

const client = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT as string,
  port: requirePort(process.env.MINIO_PORT),
  useSSL: requireBoolean("MINIO_USE_SSL", process.env.MINIO_USE_SSL),
  accessKey: process.env.MINIO_ROOT_USER as string,
  secretKey: process.env.MINIO_ROOT_PASSWORD as string,
});

/** MinIO's code for "this bucket has no policy", which is the outcome we want. */
const NO_POLICY_CODES = new Set([
  "NoSuchBucketPolicy",
  "NoSuchBucketPolicyError",
  "NoSuchPolicy",
]);

function errorCodeOf(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "";
}

/**
 * Confirms no bucket policy grants anonymous access.
 *
 * The failure that matters is AccessDenied: a credential without `s3:GetBucketPolicy`
 * cannot see a policy that exists, so treating "the read failed" as "there is no policy"
 * would report a world-readable bucket of CNIC images as private. Only the specific
 * "no such policy" codes count as proof.
 */
async function assertNoBucketPolicy(): Promise<void> {
  let policy: string;

  try {
    policy = await client.getBucketPolicy(bucket);
  } catch (error) {
    if (NO_POLICY_CODES.has(errorCodeOf(error))) {
      console.log("No bucket policy is set, so no anonymous access is possible.");
      return;
    }

    console.error(
      `Could not read the bucket policy for "${bucket}" (${errorCodeOf(error) || "unknown error"}).\n` +
        "This script cannot confirm the bucket is private, so it is refusing to report\n" +
        "that it is. Check the policy by hand before serving resident documents:\n" +
        `  mc anonymous get local/${bucket}`,
    );
    process.exit(1);
  }

  // An empty string is what some MinIO builds return in place of an error.
  if (policy.trim() === "" || policy.trim() === "{}") {
    console.log("No bucket policy is set, so no anonymous access is possible.");
    return;
  }

  console.error(
    `A bucket policy is set on "${bucket}". Private buckets must have none, because a\n` +
      "policy is the only way an anonymous request can reach a resident's CNIC image.\n" +
      "Remove it and re-run:\n" +
      `  mc anonymous set none local/${bucket}\n\n` +
      `Current policy:\n${policy}`,
  );
  process.exit(1);
}

async function main() {
  const exists = await client.bucketExists(bucket);

  if (exists) {
    console.log(`Private bucket "${bucket}" already exists.`);
  } else {
    await client.makeBucket(bucket);
    console.log(`Created private bucket "${bucket}".`);
  }

  await assertNoBucketPolicy();
}

main().catch((error) => {
  console.error(
    "Storage initialization failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
