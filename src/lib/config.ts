/**
 * Required configuration. `ConfigurationError` lets a route report a missing
 * variable by name instead of failing with a generic 500.
 */

export class ConfigurationError extends Error {
  constructor(readonly variable: string, message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/** Names of required variables that are missing or invalid. */
export function missingRequiredConfig(): string[] {
  const missing: string[] = [];

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) missing.push("SESSION_SECRET");

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push("DATABASE_URL");
  }

  return missing;
}
