/**
 * The cart's clock.
 *
 * Every time and date the app shows, and every "today" it filters by, is in one
 * configured zone: the zone the cart physically operates in. Not the server's,
 * and not the viewer's.
 *
 * Without this, dates silently followed whatever machine rendered them. A
 * developer's laptop is in the cart's zone, so everything looked right; Vercel
 * and Supabase run on UTC, so in production an 8:15 order printed on its
 * receipt as 12:15, "today" on the dashboard rolled over at 8 PM, and a client
 * component rendered one time on the server and a different one on the iPad.
 * None of that is visible until it ships, which is why it is fixed here once
 * rather than at each call site.
 *
 * `NEXT_PUBLIC_` because client components format times too, and they must
 * agree with the server character for character or React reports a hydration
 * mismatch. A zone is not a secret.
 *
 * Pure: no database, no React, testable on its own.
 */

/** Used when nothing is configured, or when what is configured is not a zone. */
export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * Returns `value` if it names a real IANA zone, otherwise the default.
 *
 * A typo here would otherwise throw a RangeError from every formatter on every
 * page, which takes the whole app down over one setting. Falling back keeps
 * the cart running and the log says which value was refused.
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

/**
 * A formatter pinned to the cart's zone.
 *
 * Call sites use this instead of `new Intl.DateTimeFormat` so that forgetting
 * the zone is not possible; that omission is the whole bug this module exists
 * to prevent.
 */
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
  // Rejects 2026-02-30 and friends, which Date would quietly roll forward.
  return probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
    ? (value as LocalDate)
    : null;
}

/** The calendar date an instant falls on, in the given zone. */
export function localDate(instant: Date, timeZone: string = TIME_ZONE): LocalDate {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape wanted.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Calendar arithmetic, not clock arithmetic.
 *
 * Adding 86,400,000 ms to a midnight is wrong twice a year: the day daylight
 * saving starts is 23 hours long and the day it ends is 25. Stepping the
 * calendar date and converting afterwards is right every day.
 */
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
 * The instant local midnight begins on a calendar date, in the given zone.
 *
 * This is the boundary every "today" query needs. Computed by guessing the
 * offset, then correcting with the offset at the guess, which converges even
 * on a day whose offset changes.
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
