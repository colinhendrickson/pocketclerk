import { expect, test, type Page } from "@playwright/test";

import { pairDevice } from "./helpers";

/**
 * Two students on one shift (ticket 4.21), as the first program asked: "I
 * can't log in multiple workers at a time". The second student joins rather
 * than replacing the first, either can be put at the register with one tap,
 * and only the last to leave does the closing list.
 *
 * Assumes a seeded database (`pnpm seed`). Every seeded PIN is 1234. Uses the
 * second and third students so the whole-shift spec keeps the first.
 */

const PIN = ["1", "2", "3", "4"];

async function signIn(page: Page, index: number): Promise<string> {
  const link = page.locator('a[href^="/pin/"]').nth(index);
  // Lines: the avatar's initial, the name, then "Working now" if clocked in.
  const name = (await link.innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[1];
  await link.click();
  await expect(page).toHaveURL(/\/pin\//);
  for (const digit of PIN) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await expect(page).toHaveURL(/\/shift$/, { timeout: 20_000 });
  return name;
}

test("two students work the cart at once", async ({ page }) => {
  await pairDevice(page);
  await page.goto("/cart");

  const first = await signIn(page, 1);
  await expect(page.getByRole("heading", { name: `Welcome, ${first}!` })).toBeVisible();
  const crew = page.getByRole("region", { name: "Working now" });
  await expect(crew.getByText("At the register")).toBeVisible();

  await test.step("a second student joins without replacing the first", async () => {
    await crew.getByRole("link", { name: "Add a worker" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Tap your name to join the shift")).toBeVisible();
    await expect(page.locator('a[href^="/pin/"]').nth(1)).toContainText("Working now");

    const second = await signIn(page, 2);
    await expect(page.getByRole("heading", { name: `Welcome, ${second}!` })).toBeVisible();
    await expect(crew.getByRole("button", { name: `Switch to ${first}` })).toBeVisible();
  });

  await test.step("one tap puts the first student back at the register", async () => {
    await crew.getByRole("button", { name: `Switch to ${first}` }).click();
    await expect(page.getByRole("heading", { name: `Welcome, ${first}!` })).toBeVisible();
  });

  await test.step("leaving early skips the closing list", async () => {
    await page.getByRole("button", { name: /Clock out/ }).click();
    await expect(page.getByRole("heading", { name: "Ready to clock out?" })).toBeVisible();
    await expect(page.getByText(/still working, so the last one to clock out/)).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    await page.getByRole("button", { name: /^Clock out$/ }).click();
    await expect(page.getByRole("heading", { name: `Nice work, ${first}!` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/still working\.$/)).toBeVisible();

    // The other student takes the register; the cart carries on.
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/shift$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Welcome,/ })).not.toHaveText(
      `Welcome, ${first}!`,
    );
    await expect(crew.getByRole("button", { name: /Switch to/ })).toHaveCount(0);
  });

  await test.step("the last one out closes the cart", async () => {
    await page.getByRole("button", { name: /Clock out/ }).click();
    await expect(page.getByRole("heading", { name: "Before you clock out" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Finish the list above first/ })).toBeDisabled();

    const boxes = page.getByRole("checkbox");
    const total = await boxes.count();
    for (let i = 0; i < total; i++) await boxes.nth(i).click();

    await page.getByRole("button", { name: /^Clock out$/ }).click();
    await expect(page.getByText("You can close the cart now.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/cart$/, { timeout: 20_000 });
    await expect(page.getByText("Tap your name to start your shift")).toBeVisible();
  });
});
