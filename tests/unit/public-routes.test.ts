import { describe, expect, it } from "vitest";
import {
  isApiPath,
  isPublicPath,
  loginRedirectPath,
  safeNextPath,
} from "@/lib/public-routes";

/**
 * The public/private split used to be a negative lookahead inside the middleware matcher,
 * which is exactly why it was wrong in four ways on the day it shipped and nothing noticed.
 * A regex embedded in a config object cannot be asserted; this can.
 */
describe("isPublicPath", () => {
  it("lets the container health probe through", () => {
    // It did not. The probe was answered with a 307 to /login, and `curl -fsS` — no -L,
    // and -f only fails on 4xx/5xx — exited 0 on the redirect. The container reported
    // healthy with PostgreSQL down, which is the one condition it exists to detect.
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("lets the sign-in endpoints through, or nobody can ever sign in", () => {
    expect(isPublicPath("/api/auth/sign-in/email")).toBe(true);
  });

  it("does NOT make every API route public", () => {
    // The first version listed a blanket `/api`, defended by a comment saying each
    // handler authorizes itself. True of the two that existed — and it made every future
    // handler unauthenticated the moment it was created. Route handlers never render the
    // root layout, so middleware is the only layer that can set this default, and it is
    // now closed. The two existing handlers still call requireMembership() themselves.
    expect(isPublicPath("/api/uploads")).toBe(false);
    expect(isPublicPath("/api/documents/abc123")).toBe(false);
    expect(isPublicPath("/api/anything-added-tomorrow")).toBe(false);
  });

  it("recognises API paths so they are refused rather than redirected", () => {
    // A fetch() redirected to the login screen receives 200 and a page of markup, which a
    // client reads as success. That is precisely how the health probe reported healthy
    // with the database down.
    expect(isApiPath("/api/uploads")).toBe(true);
    expect(isApiPath("/apidocs")).toBe(false);
  });

  it("lets a resident reach the document upload page with no account", () => {
    // Opened from a WhatsApp link by someone who was admitted an hour ago and has no
    // credentials. Redirecting them to a login screen ends the journey.
    expect(isPublicPath("/admissions/upload")).toBe(true);
  });

  it("serves robots.txt instead of redirecting crawlers to the login page", () => {
    expect(isPublicPath("/robots.txt")).toBe(true);
  });

  it("serves static assets and Next's own output", () => {
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicPath("/pwa-icons/icon-192.svg")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
  });

  it("protects every screen that shows a resident's records", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/residents",
      "/residents/detail",
      "/payments",
      "/payments/proofs",
      "/settings",
      "/police-verification",
      "/resident-portal",
      "/checkout",
    ]) {
      expect(isPublicPath(path), `${path} must require a session`).toBe(false);
    }
  });

  it("does not treat a lookalike prefix as public", () => {
    // The old matcher used unanchored prefixes, so `/login-help` and `/api-docs` would
    // have been exempted by the entries meant for `/login` and `/api`.
    expect(isPublicPath("/login-help")).toBe(false);
    expect(isPublicPath("/admissions/uploads-report")).toBe(false);
  });

  it("still protects the admissions screens either side of the public upload page", () => {
    expect(isPublicPath("/admissions")).toBe(false);
    expect(isPublicPath("/admissions/new")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/residents/detail?id=R1001")).toBe("/residents/detail?id=R1001");
  });

  it("refuses an absolute URL", () => {
    expect(safeNextPath("https://evil.example/steal")).toBeNull();
  });

  it("refuses the protocol-relative form a naive check waves through", () => {
    // `"//evil.example".startsWith("/")` is true, and the browser reads it as an absolute
    // URL. This is how a login screen becomes an open redirect on the one domain
    // residents are told to trust with photographs of their identity cards.
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
  });

  it("refuses a public path, so signing in cannot bounce back to the login screen", () => {
    expect(safeNextPath("/login")).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("loginRedirectPath", () => {
  it("carries a deep link so signing in returns you to it", () => {
    expect(loginRedirectPath("/residents/detail", "?id=R1001")).toBe(
      "/login?next=%2Fresidents%2Fdetail%3Fid%3DR1001",
    );
  });

  it("does not carry `/`, which just means take me home", () => {
    expect(loginRedirectPath("/")).toBe("/login");
  });
});
