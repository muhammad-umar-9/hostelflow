/**
 * Creates the private MinIO bucket if it does not exist.
 *
 * Idempotent, so the deployment entrypoint runs it on every boot. It never applies a
 * bucket policy: a new MinIO bucket allows no anonymous access, and that is exactly what
 * CNIC images and payment proofs require. The only way to read an object is through the
 * application's authorized download route.
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

const bucket = process.env.MINIO_BUCKET_PRIVATE as string;

const client = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT as string,
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ROOT_USER as string,
  secretKey: process.env.MINIO_ROOT_PASSWORD as string,
});

async function main() {
  const exists = await client.bucketExists(bucket);

  if (exists) {
    console.log(`Private bucket "${bucket}" already exists.`);
  } else {
    await client.makeBucket(bucket);
    console.log(`Created private bucket "${bucket}".`);
  }

  // Verifiable evidence that the bucket is not public. If a policy is ever applied by
  // hand, this prints it so the operator sees it rather than assuming privacy.
  try {
    const policy = await client.getBucketPolicy(bucket);
    console.warn(
      "A bucket policy is set. Private buckets should have none; review it:\n" + policy,
    );
  } catch {
    console.log("No bucket policy is set, so no anonymous access is possible.");
  }
}

main().catch((error) => {
  console.error(
    "Storage initialization failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
