import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

import { demoDatabaseUrl } from "./tests/e2e/demo-database";

// Playwright runs outside Next.js, so it does not read .env.local on its own.
// Without this the suite cannot pair with a deployment that requires it, and
// every student test fails at the door for a reason that looks like a bug.
loadEnv({ path: [".env.local", ".env"] });

const DEMO_PORT = 3100;

/**
 * End-to-end configuration.
 *
 * Correctness is carried by the unit tests and the database constraints; these
 * specs cover what only a real browser can: a whole shift from sign-in to
 * clock-out, every screen at five sizes with axe, keyboard use, and the demo.
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

  projects: [
    {
      name: "ipad-landscape",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /demo\.spec\.ts/,
    },
    // The public demo, on its own server and its own database
    // (scripts/demo-db.ts prepares it), so its resets never touch the data the
    // other specs rely on.
    {
      name: "demo",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}` },
      testMatch: /demo\.spec\.ts/,
    },
  ],

  // Reuses an already-running dev server locally so a developer does not wait
  // for a second one to boot; CI always starts its own.
  webServer: [
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next dev -p ${DEMO_PORT}`,
      url: `http://localhost:${DEMO_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_DIST_DIR: ".next-demo",
        NEXT_PUBLIC_SITE_MODE: "demo",
        DATABASE_URL: demoDatabaseUrl(process.env.DATABASE_URL ?? "postgresql://localhost/pocketclerk"),
        // The public demo has no pairing code: anyone may try the cart.
        DEVICE_CODE: "",
      },
    },
  ],
});
