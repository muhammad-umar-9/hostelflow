import "server-only";

/**
 * True when an error is Next's static-generation bailout rather than a real failure.
 *
 * `headers()` and `cookies()` throw this **on purpose** during prerendering, to tell the
 * framework that the route depends on the request and must be rendered on demand. It looks
 * exactly like a failure, which is what makes it dangerous: a `try/catch` written to
 * tolerate "no request here" swallows the signal, and the route silently prerenders as
 * static HTML with whatever the fallback produced baked in — for this application, an
 * authenticated page built once at deploy time showing signed-out navigation to everybody.
 *
 * It has been introduced twice now, in `optionalRequestContext` and again in `getViewer`,
 * which is why the check lives in one place instead of being rewritten per caller.
 *
 * Callers must **rethrow** when this returns true.
 */
export function isDynamicBailout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const digest = (error as Error & { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith("DYNAMIC_SERVER_USAGE"))
    return true;

  return error.name === "DynamicServerError";
}
