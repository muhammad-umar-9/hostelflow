import "server-only";

import { z } from "zod";

/**
 * Validated server environment.
 *
 * Nothing here is ever exposed to the browser: this module imports `server-only`, so a
 * client component that imports it (directly or transitively) fails the build instead of
 * shipping a secret in the bundle. No value in this file may be given a `NEXT_PUBLIC_`
 * name.
 *
 * Validation is lazy and memoized rather than done at import time. `next build` imports
 * route modules to collect metadata, and a build machine legitimately has no database
 * password; failing at import would make the production build depend on production
 * secrets. Reading the config at request time fails just as loudly, in the right place.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Public origin of the app, e.g. https://hostel.example.com. No trailing slash. */
  APP_URL: z
    .string()
    .url("APP_URL must be an absolute URL, e.g. https://hostel.example.com")
    .transform((value) => value.replace(/\/+$/, "")),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /**
   * Session signing secret. Generate on the server with `openssl rand -base64 48`.
   * A short secret is refused outright rather than silently accepted.
   */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  /** MinIO host only, e.g. `minio` inside compose or `storage.example.com`. */
  MINIO_ENDPOINT: z.string().min(1, "MINIO_ENDPOINT is required"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MINIO_ROOT_USER: z.string().min(1, "MINIO_ROOT_USER is required"),
  MINIO_ROOT_PASSWORD: z.string().min(1, "MINIO_ROOT_PASSWORD is required"),
  MINIO_BUCKET_PRIVATE: z.string().min(1, "MINIO_BUCKET_PRIVATE is required"),

  /** Largest upload accepted by the protected upload route, in bytes. */
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),

  /** Lifetime of a signed download URL, in seconds. Kept short on purpose. */
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(120),

  /**
   * Which front end sits in front of the app, and therefore which client-address header
   * can be believed when writing audit rows.
   *
   * Validated rather than read raw from process.env: every value here is an ordinary
   * request header that a client can send, so a typo would silently switch off audit
   * address capture across the whole deployment with nothing to notice. An unknown value
   * now fails at startup instead.
   */
  TRUSTED_PROXY: z.enum(["cloudflare", "reverse-proxy", "none"]).default("none"),

  /**
   * Enables the development-only demo mode. Refused outside development by the check
   * below, so it cannot be switched on in production by setting an env var.
   */
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

/** Parses and memoizes the environment. Throws with every problem listed at once. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    // The message names the variables, never their values.
    throw new Error(`Invalid server environment:\n${problems}`);
  }

  if (parsed.data.DEMO_MODE && parsed.data.NODE_ENV === "production") {
    throw new Error(
      "DEMO_MODE cannot be enabled in production. Demo data and the role switcher are " +
        "development-only and must never be reachable on a live hostel.",
    );
  }

  cached = parsed.data;
  return cached;
}

/** True only in a real development run. Never true in a production container. */
export function isDemoMode(): boolean {
  const env = serverEnv();
  return env.DEMO_MODE && env.NODE_ENV !== "production";
}

/** Test seam: clears the memoized environment. */
export function resetServerEnvCache(): void {
  cached = null;
}
