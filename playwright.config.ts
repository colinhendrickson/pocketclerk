import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Playwright runs outside Next.js, so it does not read .env.local on its own.
// Without this the suite cannot pair with a deployment that requires it, and
// every student test fails at the door for a reason that looks like a bug.
loadEnv({ path: [".env.local", ".env"] });

/**
 * End-to-end configuration.
 *
 * There are two specs, and that is deliberate. End-to-end tests are slow and
 * the flakiest thing in any suite; correctness is carried by the unit tests and
 * by the database constraints. The shift spec proves the seams connect: that a
 * real browser can drive a real server against a real Postgres from sign-in to
 * clock-out. The responsive spec proves every screen fits every screen size,
 * which no other test can see.
 *
 * The default viewport is an iPad in landscape, the cart's own device. The
 * responsive spec sets its own sizes.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // A shift is a sequence; running its steps concurrently would only test that
  // two browsers can fight over the same seeded student.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1180, height: 820 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "ipad-landscape", use: { ...devices["Desktop Chrome"] } }],

  // Reuses an already-running dev server locally so a developer does not wait
  // for a second one to boot; CI always starts its own.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
