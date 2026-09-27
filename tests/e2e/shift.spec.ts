import { expect, test } from "@playwright/test";

import { pairDevice } from "./helpers";

/**
 * One shift, end to end.
 *
 * Sign in, clock in, sell a coffee, count the change, count the inventory, work
 * through the closing checklist, clock out. This is the whole product in one
 * pass, and its job is to prove the seams connect: browser to server actions to
 * Postgres and back.
 *
 * The money assertions are the point. Unit tests already prove `changeCents` is
 * correct in isolation; this proves the correct number reaches the screen a
 * student is looking at, which is a different claim.
 *
 * Assumes a seeded database (`pnpm seed`). Every seeded PIN is 1234.
 */

const PIN = ["1", "2", "3", "4"];

test("a student works a whole shift", async ({ page }) => {
  await test.step("sign in and clock in", async () => {
    await pairDevice(page);
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Names are links, not a dropdown: there is no typing on this screen.
    await page.locator('a[href^="/pin/"]').first().click();
    await expect(page).toHaveURL(/\/pin\//);

    for (const digit of PIN) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }

    // No confirm button: the fourth digit submits.
    await expect(page).toHaveURL(/\/shift$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
  });

  await test.step("sell a coffee and count the change", async () => {
    await page.getByRole("button", { name: /Start classroom order/i }).click();
    await expect(page).toHaveURL(/\/shift\/order$/);

    await page.locator("button:has(.card-body)").first().click();
    // Pictures beside the names, for students who cannot read them yet. The
    // seed gives decaf its own mug with a D, and sugar a sugar cube.
    await expect(page.locator('svg[data-menu-icon="decaf"]')).toBeVisible();

    await page.getByRole("button", { name: /Add one Coffee$/i }).first().click();
    await expect(
      page.getByRole("button", { name: "Sugar", exact: true }).locator('svg[data-menu-icon="sugar"]'),
    ).toBeVisible();

    // A dollar coffee.
    await expect(page.getByText("$1.00").first()).toBeVisible();

    await page.getByRole("button", { name: /Go to payment/i }).click();

    // The teacher hands over a five. Three dollars back, and the hint has to
    // name the actual bills, because that line is the teaching surface.
    await page.getByRole("button", { name: /^\$5/ }).click();
    await expect(page.getByText("$4.00")).toBeVisible();
    await expect(page.getByText("4 one-dollar bills")).toBeVisible();

    await page.getByRole("button", { name: /Change given/i }).click();
    await expect(page.getByRole("heading", { name: /Change given/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  await test.step("the order appears in today's list", async () => {
    await page.getByRole("button", { name: /Back to your shift/i }).click();
    await expect(page).toHaveURL(/\/shift$/);

    await page.getByRole("button", { name: /Today.s orders/i }).click();
    await expect(page).toHaveURL(/\/shift\/orders$/);
    await expect(page.getByText("$1.00").first()).toBeVisible();
  });

  await test.step("count the inventory and restock", async () => {
    await page.goto("/shift/inventory");

    const rows = page.locator('li:has(button[aria-label^="One fewer"])');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await rows.nth(i).locator('button[aria-label^="One fewer"]').click();
    }

    // Anything below par has to be restocked before the shift can end.
    let outstanding = await page.getByRole("button", { name: /Mark restocked/i }).count();
    while (outstanding > 0) {
      await page.getByRole("button", { name: /Mark restocked/i }).first().click();
      outstanding = await page.getByRole("button", { name: /Mark restocked/i }).count();
    }

    await page.getByRole("button", { name: /Done, go to clock out/i }).click();
    await expect(page).toHaveURL(/\/clock-out$/);
  });

  await test.step("the checklist gates clock-out", async () => {
    const clockOut = page.getByRole("button", { name: /Finish the list above first/i });
    await expect(clockOut).toBeDisabled();

    const boxes = page.getByRole("checkbox");
    const total = await boxes.count();
    for (let i = 0; i < total; i++) {
      await boxes.nth(i).click();
    }

    await page.getByRole("button", { name: /^Clock out$/ }).click();
  });

  await test.step("the shift summary is saved, not just displayed", async () => {
    await expect(page.getByRole("heading", { name: /Nice work,/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Hours worked")).toBeVisible();

    // Reloading proves the summary came from the database rather than from
    // component state that happened to survive the click.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Nice work,/ })).toBeVisible();
  });
});

test("a wrong PIN is refused, with a message a student can act on", async ({
  page,
}) => {
  await pairDevice(page);
  await page.goto("/cart");
  await page.locator('a[href^="/pin/"]').first().click();

  for (const digit of ["9", "9", "9", "9"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }

  // Targeted by id, not by role. The framework renders its own live region with
  // role=alert, and on this page it announces "enter your PIN", so both a bare
  // role query and a text filter mentioning PIN match two elements. That passed
  // locally and failed in CI, which is the worst way to learn it.
  const message = page.locator("#pin-error");

  // The exact wording depends on how many attempts this student has already
  // used, which persists in the database. All three outcomes are correct
  // behavior; what matters is that the student is told what to do next rather
  // than shown a failure.
  await expect(message).toContainText(
    /tries left|One more try|Too many tries/,
    { timeout: 15_000 },
  );

  // And, most importantly, no shift was started.
  await expect(page).toHaveURL(/\/pin\//);
});

test("an unpaired device is shown nothing about the students", async ({ page }) => {
  test.skip(!process.env.DEVICE_CODE, "pairing is not enabled on this deployment");

  await page.context().clearCookies();
  await page.goto("/cart");

  // The roster is the part that matters. A stranger who finds the address must
  // not learn the first names of the children who work the cart.
  await expect(page).toHaveURL(/not-set-up/);
  await expect(page.getByText(/not set up for the cart yet/)).toBeVisible();
  await expect(page.locator('a[href^="/pin/"]')).toHaveCount(0);
});

test("a wrong setup code does not pair the device", async ({ page }) => {
  test.skip(!process.env.DEVICE_CODE, "pairing is not enabled on this deployment");

  await page.context().clearCookies();
  await page.goto("/setup?code=definitely-not-the-code");
  await expect(page).toHaveURL(/not-set-up/);

  await page.goto("/cart");
  await expect(page).toHaveURL(/not-set-up/);
});

test("opening / on a school's copy lands on the cart", async ({ page }) => {
  // Old bookmarks, and the iPad's home-screen icon, still open the bare address.
  await pairDevice(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator('a[href^="/pin/"]').first()).toBeVisible();
});
