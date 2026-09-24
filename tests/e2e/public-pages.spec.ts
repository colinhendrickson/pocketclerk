import { expect, test } from "@playwright/test";

/**
 * Nothing a stranger can open on a school's copy names the school.
 *
 * Checked in the raw response, not the visible text, because a name in an
 * attribute or the web app manifest is just as public as one on screen. The
 * names are read from the environment the same way the app reads them, with the
 * same fallbacks, so this holds for a real deployment's names too.
 */

const cartName = process.env.NEXT_PUBLIC_CART_NAME || "Sunrise Snack Cart";
const programName = process.env.NEXT_PUBLIC_PROGRAM_NAME || "Maple Grove Learning Program";

const PUBLIC_PATHS = [
  "/admin/sign-in",
  "/admin/sign-in?sent=1&email=someone%40example.edu",
  "/admin/verify?token=not-a-real-token",
  "/not-set-up",
  "/manifest.webmanifest",
];

for (const path of PUBLIC_PATHS) {
  test(`${path} does not name the school`, async ({ request }) => {
    const response = await request.get(path);
    const body = await response.text();
    expect(body, "cart name").not.toContain(cartName);
    expect(body, "program name").not.toContain(programName);
    expect(body).toContain("PocketClerk");
  });
}

test("search engines are asked to stay away", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);

  const page = await (await request.get("/admin/sign-in")).text();
  expect(page).toMatch(/<meta name="robots" content="noindex, nofollow"/);
});
