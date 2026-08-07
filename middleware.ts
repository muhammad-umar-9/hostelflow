import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route protection.
 *
 * **This is a redirect, not a security boundary.** It checks only that a session cookie is
 * present, without validating it — middleware runs on the edge runtime, where opening a
 * database connection per request is not viable. A forged cookie gets past this and then
 * hits `requireUser()` / `requireMembership()` in the page or action, which do the real
 * work: verify the session against the database, reject a disabled account, and resolve
 * the hostel and role.
 *
 * So its job is purely to send a signed-out visitor to the login screen instead of letting
 * them watch an authenticated page render and then fail. Deleting this file would not make
 * a single record readable; it would only make the failure uglier.
 *
 * Anything genuinely public belongs in the matcher exclusions below, not in a check here.
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie = getSessionCookie(request);
  if (hasSessionCookie) return NextResponse.next();

  const target = new URL("/login", request.url);

  // Preserve where they were heading so sign-in can return them to it. Only a path from
  // this site is kept: putting a caller-supplied absolute URL here would turn the login
  // screen into an open redirect, which is a credible phishing aid on a domain residents
  // are being told to trust.
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/" && pathname !== "/login") {
    target.searchParams.set("next", pathname + search);
  }

  return NextResponse.redirect(target);
}

export const config = {
  /*
   * Everything except:
   *   api/auth       the sign-in endpoints themselves — protecting these locks everyone out
   *   login          the page we redirect to
   *   u/             resident document-upload links, reached from WhatsApp with no account
   *   _next, static assets, and the PWA files, which are public by nature
   */
  matcher: [
    "/((?!api/auth|login|u/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|pwa-icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
