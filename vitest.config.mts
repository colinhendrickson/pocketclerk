import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" alias in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // UI is covered by Playwright, so no DOM environment is needed.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Database tests share one Postgres instance.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    // Playwright specs, run by their own runner.
    exclude: ["tests/e2e/**"],
  },
});
