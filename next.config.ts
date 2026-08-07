import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * The full set of security headers, emitted by the application itself.
 *
 * These used to live in the Caddyfile, which was fine while Caddy was always the entry
 * point. It no longer is: under the default tunnel profile Caddy is not running at all,
 * and moving only HSTS across left the deployment serving **no Content-Security-Policy** —
 * no `script-src`, no `form-action`, no `object-src`, on the application that holds
 * residents' CNIC images. The proxy may add its own; the app no longer depends on it.
 *
 * `'unsafe-inline'` is required by the Next.js bootstrap and Tailwind's runtime style
 * injection. Removing it needs nonce-based CSP, tracked in docs/security.md.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-eval' in development only: Next's dev overlay evaluates code to reconstruct
  // server stack traces, and without it React logs an eval error instead of showing the
  // real one. Production never carries it.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Production only, and deliberately WITHOUT includeSubDomains.
  //
  // Routing now lives in the Cloudflare dashboard, so this stack can be mapped to any
  // hostname — including an apex. `includeSubDomains` there would pin HTTPS for a year
  // across every sibling subdomain, which on a shared server means other people's
  // projects. Sending it in development would also force https on localhost for a year.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Caddy stripped this; under the tunnel profile nothing does. No reason to advertise
  // the framework to anyone scanning responses.
  poweredByHeader: false,
  // Produces a self-contained server bundle, which is what the production image copies.
  output: "standalone",
  // The generated Prisma client ships engine binaries the tracer does not see by itself.
  outputFileTracingIncludes: {
    "/api/**/*": ["./lib/generated/prisma/**/*"],
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Nothing under /api is cacheable: it is all per-session, and several routes
        // return private documents.
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
