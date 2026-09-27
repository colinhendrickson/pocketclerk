import { expect, test, type Page } from "@playwright/test";

import { signInAsAdmin } from "./helpers";

/**
 * The admin side, by keyboard alone, at phone width.
 *
 * axe checks what is on the screen; it cannot check where focus goes. These
 * are the three places a keyboard or screen reader user gets lost: getting
 * past the navigation, knowing a new page has loaded, and getting out of the
 * menu drawer.
 */

test.use({ viewport: { width: 390, height: 844 } });

/**
 * Opens a page and waits for its scripts. A button pressed before the page's
 * JavaScript has loaded has no handler yet; on a cold development server that
 * window is seconds long, and a keypress in it proves nothing either way.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test("the first Tab offers a way past the navigation", async ({ page }) => {
  await open(page, "/admin/menu");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("the menu opens by keyboard, lands on its links, and Escape hands focus back", async ({
  page,
}) => {
  await open(page, "/admin");
  const button = page.getByRole("button", { name: "Menu" });
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

test("after following a link, focus is on the new page's heading", async ({ page }) => {
  await open(page, "/admin");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Orders", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/admin\/orders$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Orders");
  await expect(heading).toBeFocused();
});
