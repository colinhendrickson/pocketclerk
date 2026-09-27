import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { TOURS } from "../../src/lib/help/tours";
import { ADMIN_ROUTES } from "../../src/lib/help/types";
import { signInAsAdmin } from "./helpers";

/**
 * "Show me around" on every admin page, by keyboard alone, at phone and desktop
 * size.
 *
 * Every step must find its target at both sizes, because a tour that silently
 * drops steps on a phone is a different tour. Each step must outline exactly
 * one thing, and ending the tour must put focus back where it started.
 */

for (const size of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`every page's tour, start to finish, on a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await signInAsAdmin(page);

    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      // The button does nothing until the page hydrates; a click before that
      // is lost, so wait for the page to settle first.
      await page.waitForLoadState("networkidle");
      const start = page.getByRole("button", { name: /^(Show me around|Tour)$/ });
      await start.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const total = TOURS[route].length;

      for (let n = 1; n <= total; n++) {
        await expect(dialog, route).toContainText(`Step ${n} of ${total}`);
        await expect(dialog).toContainText(TOURS[route][n - 1].title);
        await expect(page.locator("[data-tour-active]")).toHaveCount(1);
        await expect(page.locator("[data-tour-active]")).toBeVisible();
        // Focus rests on Next (or Done), so Enter moves on.
        await page.keyboard.press("Enter");
      }

      await expect(dialog).toBeHidden();
      await expect(page.locator("[data-tour-active]")).toHaveCount(0);
      await expect(start).toBeFocused();
    }
  });
}

test("Escape ends the tour, and the open tour passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdmin(page);
  await page.goto("/admin/students");
  await page.waitForLoadState("networkidle");

  const start = page.getByRole("button", { name: /^(Show me around|Tour)$/ });
  await start.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(start).toBeFocused();
});
