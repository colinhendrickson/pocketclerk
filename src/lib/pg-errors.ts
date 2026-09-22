/**
 * Reading Postgres error detail through Drizzle's wrapper.
 *
 * Drizzle wraps driver errors in its own "Failed query" error, so the SQLSTATE
 * code and the constraint name live on `cause`. Checking the outer error
 * silently never matches, which is a mistake this codebase has already made
 * once: the double clock-in resume path looked correct and never fired.
 *
 * Constraints are the authority on uniqueness and on the single special treat.
 * The application no longer checks first and writes second, because that leaves
 * a gap two concurrent requests can both pass. It writes, and turns the refusal
 * into a sentence.
 */

/** unique_violation */
export const UNIQUE_VIOLATION = "23505";
/** check_violation */
export const CHECK_VIOLATION = "23514";
/** foreign_key_violation */
export const FOREIGN_KEY_VIOLATION = "23503";

interface PgErrorDetail {
  code?: string;
  constraint_name?: string;
}

export function pgError(error: unknown): PgErrorDetail | null {
  const cause = (error as { cause?: PgErrorDetail } | null)?.cause;
  return cause?.code ? cause : null;
}

/** True when the failure was this specific constraint refusing the write. */
export function violated(error: unknown, constraint: string): boolean {
  return pgError(error)?.constraint_name === constraint;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgError(error)?.code === UNIQUE_VIOLATION;
}
