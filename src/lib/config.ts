/**
 * Configuration that must be present for the app to work at all.
 *
 * A missing secret currently surfaces as a blank 500 on whichever screen
 * happens to need it first, which tells an administrator standing in a school
 * office nothing at all. Worse, it fails late and unevenly: the sign-in page
 * renders, the form submission dies, and student clock-in dies too, all from one
 * absent variable.
 *
 * These helpers let a route say "this is a configuration problem, not a bug",
 * so the screen can say so and the logs can name the variable.
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

/** The variables without which nothing works. Checked, not assumed. */
export function missingRequiredConfig(): string[] {
  const missing: string[] = [];

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) missing.push("SESSION_SECRET");

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push("DATABASE_URL");
  }

  return missing;
}
