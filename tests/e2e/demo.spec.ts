import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The public demo, in a real browser, on its own server and database (see the
 * "demo" project in playwright.config.ts).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the landing page says it is a demo and offers both ways in", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Demo" });
  await expect(banner).toContainText("This is a demo. Everything resets every hour.");
  await expect(banner.getByRole("button", { name: "Start over" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try the cart" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Look around as an admin" })).toBeVisible();
  // One primary action per screen, and the banner's is not it. The skip link
  // is primary too, but hidden until focused.
  await expect(page.locator(".btn-primary").filter({ hasNotText: "Skip to content" })).toHaveCount(1);
});

for (const width of [390, 1440]) {
  test(`the landing page passes axe at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, "no sideways scrolling").toBe(false);
  });
}

test("Try the cart reaches the students without pairing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator('a[href^="/pin/"]').first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Demo" })).toBeVisible();
});

test("Look around as an admin signs in without an email", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Look around as an admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Hello,/ })).toBeVisible();
});

test("Start over comes back to the landing page", async ({ page }) => {
  await page.goto("/cart");
  await page.getByRole("region", { name: "Demo" }).getByRole("button", { name: "Start over" }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "A coffee cart, run by students" })).toBeVisible();
});
