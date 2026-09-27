import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "./src/*" alias in tsconfig.json so tests import
    // modules exactly the way the app does.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Money math is pure: no DOM, no React, no mocks. Component behavior is
    // covered by the Playwright flow instead, so jsdom is not a dependency.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Database tests share one Postgres, so they must not race each other.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    // Playwright owns tests/e2e and uses its own runner; Vitest would try to
    // execute those specs and fail on the missing test context.
    exclude: ["tests/e2e/**"],
  },
});
