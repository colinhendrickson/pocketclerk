import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * A single-connection client for the database under test.
 * Callers end it with `sql.end()` when done.
 */
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set.");
  return postgres(url, { max: 1 });
}

/**
 * Signs the admin cookie the way the app does, so admin pages open without an
 * email round trip. Uses the first admin when no person id is given.
 */
export async function signInAsAdmin(page: Page, personId?: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set.");
  if (!personId) {
    const sql = database();
    const [admin] = await sql<{ person_id: string }[]>`SELECT person_id FROM admin_users LIMIT 1`;
    await sql.end();
    personId = admin.person_id;
  }
  const signature = createHmac("sha256", secret).update(personId).digest("base64url");
  await page.context().addCookies([
    {
      name: "pocketclerk_admin",
      value: `${personId}.${signature}`,
      url: test.info().project.use.baseURL ?? "http://localhost:3000",
    },
  ]);
}

/**
 * Pairs the browser with the cart, the way an adult sets up the iPad once.
 * Does nothing when DEVICE_CODE is unset, as on the public demo.
 */
export async function pairDevice(page: Page) {
  const code = process.env.DEVICE_CODE;
  if (!code) return;
  await page.goto(`/setup?code=${encodeURIComponent(code)}`);
  await expect(page).toHaveURL(/\/cart$/);
}
