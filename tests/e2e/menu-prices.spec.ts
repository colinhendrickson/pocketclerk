import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * A price typed on the menu page is the price saved, when adding and when
 * editing.
 *
 * The first real administrator typed 1.00 for a coffee and got $100.00, then
 * edited it to 1.00 and got $100.00 again: the page sent cents and the server
 * read them as dollars. Every unit test passed, because they fed the server a
 * payload the page never sent. This goes through the page itself.
 */

const name = `E2E Price Check ${Date.now()}`;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set.");
  return postgres(url, { max: 1 });
}

test.beforeEach(async ({ page }) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set.");
  const sql = database();
  const [admin] = await sql<{ person_id: string }[]>`SELECT person_id FROM admin_users LIMIT 1`;
  await sql.end();
  const signature = createHmac("sha256", secret).update(admin.person_id).digest("base64url");
  await page.context().addCookies([
    {
      name: "pocketclerk_admin",
      value: `${admin.person_id}.${signature}`,
      url: test.info().project.use.baseURL ?? "http://localhost:3000",
    },
  ]);
});

test.afterAll(async () => {
  const sql = database();
  await sql`DELETE FROM menu_items WHERE name = ${name}`;
  await sql.end();
});

test("the price typed is the price saved, when adding and when editing", async ({ page }) => {
  await page.goto("/admin/menu");
  await page.waitForLoadState("networkidle");

  const items = page.locator('[data-tour="menu-items"]');
  await items.getByRole("textbox").first().fill(name);
  await items.getByPlaceholder("1.50").fill("1.00");
  await items.getByRole("button", { name: "Add item" }).click();

  const row = items.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("$1.00");

  await row.getByRole("button", { name: "Edit" }).click();
  const editing = items.getByRole("row").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editing.getByLabel(/^Price in dollars for/).fill("2.25");
  await editing.getByRole("button", { name: "Save" }).click();

  await expect(items.getByRole("row").filter({ hasText: name })).toContainText("$2.25");

  const sql = database();
  const [saved] = await sql<{ price_cents: number }[]>`SELECT price_cents FROM menu_items WHERE name = ${name}`;
  await sql.end();
  expect(saved.price_cents).toBe(225);
});
