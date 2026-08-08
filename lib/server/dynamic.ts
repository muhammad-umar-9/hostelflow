import "server-only";

import { unstable_rethrow } from "next/navigation";

/**
 * Rethrows anything that is a framework control-flow signal rather than a failure.
 *
 * `headers()` and `cookies()` throw **on purpose** during prerendering, to tell Next that
 * a route depends on the request and must render on demand. `redirect()` and `notFound()`
 * throw too. All of them look exactly like errors, which is what makes them dangerous: a
 * `try/catch` written to tolerate "no request here" swallows the signal, and the route
 * silently prerenders as static HTML with whatever the fallback produced baked in — for
 * this application, an authenticated page built once at deploy time showing signed-out
 * navigation to everybody. The build still reports success.
 *
 * That was introduced twice, in `optionalRequestContext` and again in `getViewer`.
 *
 * This delegates to Next's own `unstable_rethrow` rather than testing for a
 * `DYNAMIC_SERVER_USAGE` digest by hand, which is what the first version did. The
 * hand-rolled check missed three things the framework's does not: errors wrapped in a
 * `cause` chain, which is how a Prisma or Better Auth failure would carry a bailout up;
 * the PPR and `cacheComponents` signals, which replace `DynamicServerError` entirely the
 * moment either flag is switched on; and `redirect()` / `notFound()`, which a broad catch
 * would otherwise absorb as "nobody is signed in". Each future Next release that adds a
 * signal widens a hand-written check and narrows nothing here.
 */
export function rethrowFrameworkSignal(error: unknown): void {
  unstable_rethrow(error);
}
