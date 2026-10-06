/**
 * The crew: every student clocked in on this iPad, so several can work the
 * cart at once (ticket 4.21). Each keeps their own shift, so hours and rewards
 * stay per student; one of them is "at the register", and the sales they ring
 * up go on their shift, so receipts still say who served.
 *
 * The crew belongs to the device, held in a signed cookie beside the register
 * cookie (src/lib/session.ts). A student joins it only by entering their PIN on
 * this iPad, so switching to them needs no PIN and nobody can be switched to
 * from somewhere else. See docs/adr/0016-several-students-on-one-shift.md.
 *
 * Pure functions only: the cookie and the database live elsewhere.
 */

/** More than any cart needs; bounds the cookie. */
export const MAX_CREW = 12;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads a crew cookie payload: comma-separated shift ids, duplicates and junk dropped. */
export function parseCrew(payload: string | null | undefined): string[] {
  if (!payload) return [];
  return withShift([], ...payload.split(",").filter((id) => UUID.test(id)));
}

export function serializeCrew(shiftIds: readonly string[]): string {
  return shiftIds.join(",");
}

/**
 * Adds shifts to the crew, keeping order and dropping duplicates. When the
 * crew is full the oldest entries go first; they are long gone by then.
 */
export function withShift(crew: readonly string[], ...shiftIds: (string | null | undefined)[]): string[] {
  const next: string[] = [];
  for (const id of [...crew, ...shiftIds]) {
    if (id && !next.includes(id)) next.push(id);
  }
  return next.slice(-MAX_CREW);
}

export function withoutShift(crew: readonly string[], shiftId: string): string[] {
  return crew.filter((id) => id !== shiftId);
}

/** Whether anyone besides the student at the register is still working. */
export function othersWorking<T extends { id: string }>(crew: readonly T[], currentId: string): T[] {
  return crew.filter((member) => member.id !== currentId);
}

/**
 * Who takes the register when the student at it leaves: whoever has been
 * working longest, so the choice is predictable. Null when nobody is left.
 */
export function nextAtRegister<T extends { id: string; clockIn: Date }>(
  crew: readonly T[],
  leavingId: string,
): T | null {
  const remaining = othersWorking(crew, leavingId);
  if (remaining.length === 0) return null;
  return remaining.reduce((first, member) => (member.clockIn < first.clockIn ? member : first));
}

/** "Sam", "Sam and Jo", "Sam, Jo and Ari": names as a student would say them. */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
