import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * Staff giving each other access, through the page rather than the script.
 *
 * The rules themselves (not yourself, not the last admin, not twice) are
 * tested against the database in tests/admins.test.ts. This proves the page
 * wires them up: the form adds, the row appears, removing asks first.
 */

const email = `e2e-admin-${Date.now()}@example.edu`;

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
  await sql`DELETE FROM admin_users WHERE person_id IN (SELECT id FROM persons WHERE email = ${email})`;
  await sql`DELETE FROM persons WHERE email = ${email}`;
  await sql.end();
});

test("an admin gives someone access, then takes it away", async ({ page }) => {
  await page.goto("/admin/admins");

  await page.getByLabel("Name").fill("Test Helper");
  await page.getByLabel("School email").fill(email);
  await page.getByRole("button", { name: "Give access" }).click();
  await expect(page.getByRole("status")).toContainText(`enter ${email}`);

  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Remove access" }).click();
  await row.getByRole("button", { name: "Yes, remove" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toHaveCount(0);
});

test("your own row cannot be removed", async ({ page }) => {
  await page.goto("/admin/admins");
  const mine = page.getByRole("listitem").filter({ hasText: "You" });
  await expect(mine).toContainText("Another admin can remove your access");
  await expect(mine.getByRole("button", { name: "Remove access" })).toHaveCount(0);
});
