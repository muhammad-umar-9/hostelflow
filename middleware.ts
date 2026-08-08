import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isPublicPath, loginRedirectPath } from "@/lib/public-routes";

/** The header the root layout reads to learn which path it is rendering. */
export const PATHNAME_HEADER = "x-hostelflow-pathname";

/**
 * A fast redirect for signed-out visitors — **and nothing more.**
 *
 * An earlier version of this file claimed the real check happened downstream, in
 * `requireUser()` / `requireMembership()` called by the page. That was false: every screen
 * under `app/` is a client component, and a repository-wide search found those helpers
 * called only from two API route handlers. So this cookie test — which `getSessionCookie`
 * performs without verifying a signature or touching the database — was the *only* gate on
 * every authenticated route, while the comment told the next reader it was the cheap one.
 *
 * A comment that overstates a guarantee is worse than no comment: it is an invitation to
 * skip the real check when these screens are converted to read live data.
 *
 * The genuine gate now lives in `app/layout.tsx`, which resolves the session against the
 * database, rejects a disabled account, and redirects before any page renders. This stays
 * because it is still worth avoiding a database round trip to tell an anonymous visitor to
 * sign in — but deleting it would cost latency, not safety.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Forwarded so the layout knows what it is rendering. Next gives a server component no
  // access to the request path, and the layout has to distinguish /login from /residents.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname);

  // Never trust an inbound copy of the header: a caller could otherwise present
  // `x-hostelflow-pathname: /login` on a request for /residents and the layout would treat
  // a protected page as public. `headers.set` above already overwrites it — this only
  // documents why `set` and not `append`.

  const proceed = () => NextResponse.next({ request: { headers } });

  if (isPublicPath(pathname)) return proceed();
  if (getSessionCookie(request)) return proceed();

  return NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url));
}

export const config = {
  /*
   * Everything except Next's own build output. What is *public* is decided by
   * `isPublicPath`, not by this pattern: a matcher regex cannot be unit-tested, and the
   * previous one silently exempted a route that does not exist while redirecting the
   * container health probe.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
