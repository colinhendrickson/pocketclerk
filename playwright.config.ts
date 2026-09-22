import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * There is exactly one spec, and that is deliberate. End-to-end tests are slow
 * and the flakiest thing in any suite; correctness is carried by the unit tests
 * and by the database constraints. This spec exists to prove the seams connect:
 * that a real browser can drive a real server against a real Postgres from
 * sign-in to clock-out.
 *
 * The viewport is an iPad in landscape, because that is the only device this
 * will ever run on.
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
