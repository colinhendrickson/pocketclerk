import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigurationError,
  isConfigurationError,
  missingRequiredConfig,
} from "@/lib/config";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("missingRequiredConfig", () => {
  it("names a secret that is absent", () => {
    delete process.env.SESSION_SECRET;
    expect(missingRequiredConfig()).toContain("SESSION_SECRET");
  });

  it("names a secret that is present but too short to be one", () => {
    // The dangerous case: set, so it looks configured, and useless.
    process.env.SESSION_SECRET = "hunter2";
    expect(missingRequiredConfig()).toContain("SESSION_SECRET");
  });

  it("accepts a real secret", () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    expect(missingRequiredConfig()).not.toContain("SESSION_SECRET");
  });

  it("accepts either spelling of the database URL", () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgresql://localhost/x";
    expect(missingRequiredConfig()).toEqual([]);
  });
});

describe("isConfigurationError", () => {
  it("distinguishes a missing setting from a genuine fault", () => {
    expect(isConfigurationError(new ConfigurationError("X", "nope"))).toBe(true);
    expect(isConfigurationError(new Error("database exploded"))).toBe(false);
  });

  it("carries the variable name, so a log can say which one", () => {
    const error = new ConfigurationError("SESSION_SECRET", "too short");
    expect(error.variable).toBe("SESSION_SECRET");
  });
});
