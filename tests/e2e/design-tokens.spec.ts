import { expect, test, type Locator } from "@playwright/test";

/**
 * The approved palette is defined as CSS variables and mapped into Tailwind by the
 * `withAlpha()` helper in tailwind.config.ts. That helper had to be re-typed during
 * stabilization, so these tests pin the colours it produces: the navy surfaces must still
 * paint, and both the plain `var(--x)` form and the `color-mix()` opacity form must reach
 * the stylesheet.
 */

/** Deep navy `--p: #0f2a47`. */
const NAVY: [number, number, number] = [15, 42, 71];
/** `--p` for `data-theme="green"`: #12402f. */
const GREEN: [number, number, number] = [18, 64, 47];

/**
 * Reads a background colour as 0-255 channels. Tailwind wraps themed colours in
 * `color-mix()`, so Chromium serializes them as `color(srgb 0.05 0.16 0.27)` rather than
 * `rgb(15, 42, 71)`; both spellings are normalized here.
 */
async function backgroundChannels(locator: Locator): Promise<[number, number, number]> {
  const value = await locator.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  const numbers = value.match(/-?[\d.]+/g)?.map(Number) ?? [];
  expect(numbers.length, `could not parse colour "${value}"`).toBeGreaterThanOrEqual(3);

  const [r, g, b] = numbers;
  return value.startsWith("color(")
    ? [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
    : [Math.round(r), Math.round(g), Math.round(b)];
}

test("the login screen paints the approved deep navy", async ({ page }) => {
  await page.goto("/login");

  const shell = page.locator("div.bg-p").first();
  await expect(shell).toBeVisible();

  const channels = await backgroundChannels(shell);
  for (const [index, expected] of NAVY.entries()) {
    expect(Math.abs(channels[index] - expected)).toBeLessThanOrEqual(1);
  }
});

test("switching the theme repaints from the CSS variables", async ({ page }) => {
  await page.goto("/login");
  const shell = page.locator("div.bg-p").first();
  await expect(shell).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "green";
  });

  const channels = await backgroundChannels(shell);
  for (const [index, expected] of GREEN.entries()) {
    expect(Math.abs(channels[index] - expected)).toBeLessThanOrEqual(1);
  }
});

test("themed colours and opacity modifiers both compile into the stylesheet", async ({
  page,
}) => {
  await page.goto("/dashboard");

  const hrefs = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(hrefs.length).toBeGreaterThan(0);

  let css = "";
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    css += await response.text();
  }

  // Themed colours resolve through the CSS variables, so themes stay swappable.
  expect(css).toContain("var(--p)");
  // Opacity modifiers (border-p/40) go through color-mix.
  expect(css).toMatch(/color-mix\(in srgb, ?var\(--p\)/);
});
