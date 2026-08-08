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

/** Prefixes served without a session. A path matches if it equals one or starts with it + "/". */
export const PUBLIC_PREFIXES = [
  // The sign-in endpoints themselves. Protecting these locks everybody out.
  "/api/auth",
  // Every other API route authorizes itself — see the requireMembership() calls in
  // app/api/uploads and app/api/documents. Redirecting an API request to an HTML login
  // page is worse than refusing it: the caller receives 200 and a page of markup.
  "/api",
  "/login",
  // Opened from a WhatsApp link by a resident who has no account and never will.
  "/admissions/upload",
] as const;

/** Files served from `public/` or emitted by Next, which carry no session by nature. */
const PUBLIC_FILES = [
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
] as const;

const PUBLIC_FILE_PREFIXES = [
  "/_next/",
  "/icons/",
  "/images/",
  "/pwa-icons/",
  "/.well-known/",
];

const STATIC_EXTENSION = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml|json|map)$/i;

/** True when a path may be served to somebody with no session. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname as (typeof PUBLIC_FILES)[number])) return true;
  if (PUBLIC_FILE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
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
