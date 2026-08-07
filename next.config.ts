import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * Caddy sets these too, so the app is not naked if it is ever run without the proxy in
 * front of it — during a local production check, for example.
 */
const securityHeaders = [
  // Set by the application, not only by the proxy. Caddy emitted this when it was the
  // entry point, but on a shared server the front end is a Cloudflare tunnel and the app
  // must carry its own guarantees rather than assume something upstream adds them.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
