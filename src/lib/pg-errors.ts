/**
 * Postgres error detail from behind Drizzle's wrapper.
 *
 * Drizzle wraps driver errors in a "Failed query" error, so the SQLSTATE code
 * and constraint name live on `cause`; checking the outer error never matches.
 * Constraints are the authority on uniqueness: callers write first and map the
 * refusal to a message, rather than check-then-write, which races.
 * See docs/adr/0004-invariants-in-the-database.md.
 */

/** unique_violation */
export const UNIQUE_VIOLATION = "23505";
/** check_violation */
export const CHECK_VIOLATION = "23514";

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
