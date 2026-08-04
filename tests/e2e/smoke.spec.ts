import { expect, test, type Page } from "@playwright/test";

/**
 * Stabilization smoke tests: every main route of the existing frontend must return 200,
 * render its own content, and raise no uncaught client exception. These guard the
 * dependency upgrade and the Tailwind configuration fix; they say nothing about
 * authorization or persistence, which arrive with the backend milestones.
 */

interface Route {
  path: string;
  /** Heading the screen renders once the (mock) data has loaded. */
  heading?: RegExp;
  /** Fallback for screens that render no <h1>; matched against the page body. */
  text?: RegExp;
}

const STAFF_ROUTES: Route[] = [
  { path: "/login", heading: /^HostelFlow$/ },
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

for (const route of [...STAFF_ROUTES, ...RESIDENT_ROUTES]) {
  test(`${route.path} renders`, async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} should return 200`).toBe(200);

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

test("/ redirects to the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("an unknown route renders the not-found screen", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/not found|404/i);
});

test("the manifest is served as a web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = (await response.json()) as { name?: string; display?: string };
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
});
