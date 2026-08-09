import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  PATHNAME_HEADER,
  SEARCH_HEADER,
  isApiPath,
  isPublicPath,
  loginRedirectPath,
} from "@/lib/public-routes";

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
  headers.set(SEARCH_HEADER, search);

  // Never trust an inbound copy of either header: a caller could otherwise present
  // `x-hostelflow-pathname: /login` on a request for /residents and the layout would treat
  // a protected page as public, or spoof `x-hostelflow-search` to steer where the layout's
  // login redirect deposits users. `headers.set` above overwrites both — this only
  // documents why `set` and not `append`.

  const proceed = () => NextResponse.next({ request: { headers } });

  if (isPublicPath(pathname)) return proceed();
  if (getSessionCookie(request)) return proceed();

  // An API caller gets a status code, not a page of markup. Redirecting fetch() to the
  // login screen answers 200 with HTML, which a client parses as success — and it is what
  // made the container health probe report healthy while the database was down.
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }

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
