import { expect, test, type Page } from "@playwright/test";
import { canRunAuthenticated } from "./config";

/**
 * Smoke tests: every main route must return 200, render its own content, and raise no
 * uncaught client exception.
 *
 * These now run **as a signed-in owner**, because the screens they visit are no longer
 * reachable without one. The session is established once by `auth.setup.ts`, driving the
 * real login form against a real database, which means the suite finally proves that
 * signing in works — something nothing checked while the login was a hard-coded OTP.
 *
 * Without E2E_DATABASE_URL there is no database to sign in to, so the authenticated
 * screens **skip**. They are never reported as passing: a suite that quietly tests nothing
 * is worse than one that admits it tested nothing.
 */

interface Route {
  path: string;
  /** Heading the screen renders once the (mock) data has loaded. */
  heading?: RegExp;
  /** Fallback for screens that render no <h1>; matched against the page body. */
  text?: RegExp;
}

const STAFF_ROUTES: Route[] = [
  { path: "/dashboard", heading: /H-K Boys Hostel/i },
  { path: "/rooms", heading: /Rooms and beds/i },
  { path: "/rooms/detail?no=101", heading: /Room 101/i },
  { path: "/enquiries", heading: /Walk-in enquiries/i },
  { path: "/residents", heading: /^Residents$/ },
  { path: "/admissions/new", heading: /New admission/i },
  { path: "/admissions/upload", heading: /.+/ },
  { path: "/payments", heading: /Monthly rent/i },
  { path: "/payments/proofs", heading: /Payment proofs/i },
  { path: "/receipts", heading: /^Receipts$/ },
  { path: "/police-verification", heading: /Police verification/i },
  { path: "/notifications", heading: /^Notifications$/ },
  { path: "/more", heading: /^More$/ },
  { path: "/settings", heading: /^Settings$/ },
];

/**
 * The detail screens, which read their record from a query parameter.
 *
 * These were missing while this file claimed to cover "every main route" — and they are
 * the ones most exposed by the Next.js 15 to 16 upgrade, because every one of them calls
 * `useSearchParams()`. Exactly the wrong seven to leave out.
 *
 * Each matcher accepts the record screen or the not-found screen: the point of a smoke
 * test is that the route renders a coherent page and throws no exception, and the demo
 * ids are fixtures rather than guarantees.
 */
const DETAIL_ROUTES: Route[] = [
  { path: "/admissions", text: /New admission/i },
  { path: "/admissions/success", text: /receipt|admission|not found/i },
  { path: "/enquiries/detail?id=E-41", text: /Enquiry/i },
  { path: "/residents/detail?id=R1001", text: /Resident profile|Resident not found/i },
  {
    path: "/payments/proofs/detail?id=PP-210",
    text: /Review payment proof|Proof not found/i,
  },
  { path: "/receipts/detail?id=RC-1", text: /Receipt/i },
  { path: "/checkout?resident=R1001", text: /Checkout|Choose a resident first/i },
];

const RESIDENT_ROUTES: Route[] = [
  // The resident home renders no <h1> today; see docs/frontend-audit.md.
  { path: "/resident-portal", text: /August rent/i },
  { path: "/resident-portal/payments", heading: /My payments/i },
  { path: "/resident-portal/requests", heading: /^Requests$/ },
  { path: "/resident-portal/profile", heading: /My profile/i },
];

/** Records uncaught client-side exceptions raised during the visit. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("authenticated screens", () => {
  test.skip(
    !canRunAuthenticated(),
    "E2E_DATABASE_URL is not set: these screens require a signed-in owner and were NOT tested.",
  );

  for (const route of [...STAFF_ROUTES, ...DETAIL_ROUTES, ...RESIDENT_ROUTES]) {
    test(`${route.path} renders`, async ({ page }) => {
      const errors = collectPageErrors(page);

      const response = await page.goto(route.path);
      expect(response?.status(), `${route.path} should return 200`).toBe(200);

      // A signed-in visit must never be bounced to the login screen. This catches a
      // middleware matcher that over-reaches, which would otherwise show up as a
      // confusing heading mismatch rather than as the redirect it actually is.
      expect(
        new URL(page.url()).pathname,
        `${route.path} redirected to sign-in`,
      ).not.toBe("/login");

      if (route.heading) {
        await expect(page.locator("h1").first()).toHaveText(route.heading, {
          timeout: 15_000,
        });
      } else if (route.text) {
        await expect(page.locator("body")).toContainText(route.text, { timeout: 15_000 });
      }

      expect(errors, `${route.path} raised client exceptions`).toEqual([]);
    });
  }

  test("an unknown route renders the not-found screen", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).toContainText(/not found|404/i);
  });
});

test.describe("signed out", () => {
  // Explicitly no session, whatever the setup project cached.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the login screen renders", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toHaveText(/^HostelFlow$/);
    await expect(page.getByLabel("EMAIL")).toBeVisible();
    await expect(page.getByLabel("PASSWORD")).toBeVisible();
  });

  test("the sign-in screen offers no way to pick a role", async ({ page }) => {
    await page.goto("/login");
    // The build this replaced filled in the OTP 4291 and let anyone choose to be the
    // owner. If either ever comes back, it comes back here first.
    await expect(page.locator("body")).not.toContainText(/DEMO ROLE|Send OTP/i);
    await expect(page.locator("body")).not.toContainText("4291");
  });

  test("/ redirects to the login screen", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a protected route redirects to sign-in and keeps the destination", async ({
    page,
  }) => {
    await page.goto("/residents");
    await expect(page).toHaveURL(/\/login\?next=%2Fresidents$/);
  });

  test("an unknown route does not reveal itself to a stranger", async ({ page }) => {
    // Deliberately a redirect rather than a 404. Answering 404 here while answering a
    // redirect for /residents would let anyone map which routes exist by watching the
    // difference — free reconnaissance on a path that needs no account to probe.
    await page.goto("/this-route-does-not-exist");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

test("the manifest is served as a web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = (await response.json()) as { name?: string; display?: string };
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
});
