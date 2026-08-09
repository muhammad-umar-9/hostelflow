/**
 * The paths reachable without a session — the single source of truth.
 *
 * This used to be a negative lookahead inside `middleware.ts`'s matcher, hand-maintained
 * and impossible to test. It was wrong in four ways on the day it was written:
 *
 *   * `/api/health` was **not** listed, so the container probe was answered with a 307 to
 *     the login page. `curl -fsS` has no `-L` and `-f` only fails on 4xx/5xx, so it exited
 *     0 on the redirect and the container reported healthy with PostgreSQL down — the one
 *     condition the probe exists to detect.
 *   * `/admissions/upload` was not listed, although it is the page a newly admitted
 *     student opens from a WhatsApp link with no account. They were redirected to a login
 *     screen where they have no credentials.
 *   * `/robots.txt` was not listed, because the escape hatch was an image-extension list.
 *   * `u/` **was** listed, for a route that does not exist anywhere in `app/`.
 *
 * So it lives here instead: one list, imported by both the matcher and the server-side
 * gate, with a unit test asserting the paths that must and must not be public.
 */

/**
 * The header middleware uses to tell the root layout which path it is rendering.
 *
 * Lives here rather than in `middleware.ts` because both sides already import this module,
 * and `app/layout.tsx` importing from the middleware pulled `next/server` and
 * `better-auth/cookies` into the RSC module graph — the application root depending on its
 * own edge middleware.
 */
export const PATHNAME_HEADER = "x-hostelflow-pathname";

/** Prefixes served without a session. A path matches if it equals one or starts with it + "/". */
export const PUBLIC_PREFIXES = [
  // The sign-in endpoints themselves. Protecting these locks everybody out.
  "/api/auth",
  // The container probe, which carries no session by design.
  "/api/health",
  "/login",
  // Opened from a WhatsApp link by a resident who has no account and never will.
  "/admissions/upload",
] as const;

/**
 * API routes are default-DENY, and this is the reason.
 *
 * The first version listed a blanket `/api` as public, defended by a comment saying every
 * handler authorizes itself. That was true of the two handlers that existed — and it made
 * the next one unauthenticated the moment it was created, with nothing in lint, types or
 * the test suite noticing. Route handlers never render `app/layout.tsx`, so the gate that
 * covers every screen does not cover them; middleware is the only layer that runs for
 * both, which makes it the only place the default can be set.
 *
 * `feature/admission-wizard-wiring` and `feature/payments-and-receipts` are the branches
 * that will add handlers writing bed allocations and payments. They now start closed.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Files with no extension the regex below can recognise. Everything else in `public/` is
 * covered by `STATIC_EXTENSION`; listing it here as well was three mechanisms doing one
 * job, and the redundancy hid that the regex alone decides most of this.
 */
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js"] as const;

const STATIC_EXTENSION = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml|json|map)$/i;

/** True when a path may be served to somebody with no session. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname as (typeof PUBLIC_FILES)[number])) return true;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/.well-known/")) return true;
  if (STATIC_EXTENSION.test(pathname)) return true;

  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * A post-sign-in destination that is safe to redirect to.
 *
 * Only a path on this site is ever accepted. An absolute URL — or the protocol-relative
 * `//evil.example` form, which a naive "starts with /" check waves through — would turn
 * the login screen into an open redirect, on the one domain residents are being told to
 * trust with photographs of their identity cards.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (isPublicPath(value)) return null;
  return value;
}

/**
 * The login URL to send a signed-out visitor to, carrying where they were going.
 *
 * `/` is deliberately not preserved: it means "take me home", and home is resolved from
 * the membership after signing in anyway, so `?next=%2F` would be noise on the most
 * common redirect in the application.
 */
export function loginRedirectPath(pathname: string, search = ""): string {
  if (pathname === "/" || isPublicPath(pathname)) return "/login";
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}
