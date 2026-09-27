/**
 * The cart's clock. All displayed times and "today" boundaries use one
 * configured zone, not the server's (UTC in production) or the viewer's.
 *
 * `NEXT_PUBLIC_` so server and client format identically and avoid hydration
 * mismatches. Pure: no database or React imports.
 */

/** Used when the configured zone is missing or invalid. */
export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * Returns `value` if it names a real IANA zone, otherwise the default. An
 * invalid zone would make every formatter throw, so fall back and log instead.
 */
export function resolveTimeZone(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    console.error(
      `[config] NEXT_PUBLIC_TIME_ZONE "${candidate}" is not a time zone. Using ${DEFAULT_TIME_ZONE}.`,
    );
    return DEFAULT_TIME_ZONE;
  }
}

export const TIME_ZONE = resolveTimeZone(process.env.NEXT_PUBLIC_TIME_ZONE);

/** A formatter pinned to the cart's zone. Use instead of `new Intl.DateTimeFormat`. */
export function cartFormatter(
  options: Intl.DateTimeFormatOptions,
  timeZone: string = TIME_ZONE,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone });
}

/** A calendar date, `YYYY-MM-DD`. A string, because a date has no instant. */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepts only a real calendar date in `YYYY-MM-DD` form. */
export function parseLocalDate(value: string | undefined): LocalDate | null {
  const match = value ? LOCAL_DATE.exec(value) : null;
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Rejects dates like 2026-02-30, which Date would roll forward.
  return probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
    ? (value as LocalDate)
    : null;
}

/** The calendar date an instant falls on, in the given zone. */
export function localDate(instant: Date, timeZone: string = TIME_ZONE): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Calendar arithmetic, not clock arithmetic, so DST days (23h/25h) are handled. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Milliseconds the zone is ahead of UTC at a given instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant local midnight begins on a calendar date in the given zone.
 * Guesses the offset, then corrects with the offset at the guess, which
 * converges even on DST transition days.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string = TIME_ZONE): Date {
  const [y, m, d] = date.split("-").map(Number);
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  const first = midnightAsUtc - offsetMs(new Date(midnightAsUtc), timeZone);
  const second = midnightAsUtc - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** Today's calendar date in the cart's zone. */
export function today(timeZone: string = TIME_ZONE): LocalDate {
  return localDate(new Date(), timeZone);
}
