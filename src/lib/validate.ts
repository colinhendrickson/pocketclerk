/**
 * Input validation for the trust boundary.
 *
 * Server actions receive whatever the browser chooses to send, so every field
 * is checked before it reaches a query. These few shapes did not justify a
 * validation library: hand-written guards keep the dependency list short and
 * make the exact accepted range of every field readable in one screen.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isFourDigitPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

/** A non-negative, finite integer — the shape every money field must have. */
export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveIntWithin(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= max;
}

export interface OrderLineInput {
  menuItemId: string;
  qty: number;
  addonIds: string[];
}

export interface CompleteOrderInput {
  teacherId: string;
  receivedCents: number;
  lines: OrderLineInput[];
}

/**
 * Validates the payload for completing an order. Returns null rather than
 * throwing so the caller can map a bad request to a typed result instead of a
 * stack trace.
 *
 * The caps are generous but finite: a classroom order is a handful of drinks,
 * and an unbounded array here is an unbounded loop in the transaction below it.
 */
export function parseCompleteOrder(input: unknown): CompleteOrderInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId, receivedCents, lines } = input as Record<string, unknown>;

  if (!isUuid(teacherId)) return null;
  if (!isCents(receivedCents)) return null;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) return null;

  const parsed: OrderLineInput[] = [];
  for (const raw of lines) {
    if (typeof raw !== "object" || raw === null) return null;
    const { menuItemId, qty, addonIds } = raw as Record<string, unknown>;

    if (!isUuid(menuItemId)) return null;
    if (!isPositiveIntWithin(qty, 20)) return null;
    if (!Array.isArray(addonIds) || addonIds.length > 10) return null;
    if (!addonIds.every(isUuid)) return null;

    parsed.push({ menuItemId, qty, addonIds: addonIds as string[] });
  }

  return { teacherId, receivedCents, lines: parsed };
}

export interface ClockInInput {
  studentId: string;
  pin: string;
}

export function parseClockIn(input: unknown): ClockInInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { studentId, pin } = input as Record<string, unknown>;
  if (!isUuid(studentId) || !isFourDigitPin(pin)) return null;
  return { studentId, pin };
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Trims a human name and enforces the one length range used everywhere.
 *
 * Shared by the student, teacher and menu parsers so that "too short" means the
 * same thing on every screen. Returns null rather than a trimmed empty string,
 * because a name that is only whitespace is a missing name, not a short one.
 */
function parseName(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > max) return null;
  return trimmed;
}

export interface NewTeacherInput {
  name: string;
  room: string | null;
  email: string | null;
}

/**
 * Validates a teacher added mid-shift.
 *
 * The email check is deliberately loose. A strict pattern rejects addresses
 * that are perfectly valid, and the cost of a typo here is one undelivered
 * receipt, which the job monitor already surfaces. Refusing to serve a teacher
 * because a regex disliked their address is the worse failure.
 */
export function parseNewTeacher(input: unknown): NewTeacherInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { name, room, email } = input as Record<string, unknown>;

  if (typeof name !== "string") return null;
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) return null;

  let trimmedRoom: string | null = null;
  if (room !== undefined && room !== null && room !== "") {
    if (typeof room !== "string") return null;
    trimmedRoom = room.trim().slice(0, 20);
    if (trimmedRoom.length === 0) trimmedRoom = null;
  }

  let trimmedEmail: string | null = null;
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string") return null;
    const candidate = email.trim().toLowerCase();
    if (candidate.length > 120) return null;
    if (!candidate.includes("@") || candidate.startsWith("@") || candidate.endsWith("@")) {
      return null;
    }
    trimmedEmail = candidate;
  }

  return { name: trimmedName, room: trimmedRoom, email: trimmedEmail };
}

/* -------------------------------------------------------------------------- */
/* Admin: students                                                            */
/* -------------------------------------------------------------------------- */

export interface NewStudentInput {
  displayName: string;
  pin: string;
}

export function parseNewStudent(input: unknown): NewStudentInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { displayName, pin } = input as Record<string, unknown>;

  const name = parseName(displayName);
  if (name === null) return null;
  if (!isFourDigitPin(pin)) return null;

  return { displayName: name, pin };
}

export interface ResetPinInput {
  studentId: string;
  pin: string;
}

export function parseResetPin(input: unknown): ResetPinInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { studentId, pin } = input as Record<string, unknown>;
  if (!isUuid(studentId) || !isFourDigitPin(pin)) return null;
  return { studentId, pin };
}

export interface ActiveToggleInput {
  id: string;
  active: boolean;
}

/**
 * The payload behind every activate/deactivate button in the admin area.
 *
 * `active` is sent as the intended end state rather than flipped server-side.
 * A toggle that reads the current value and inverts it turns a double-click, or
 * a stale tab, into a silent reversal of what the administrator just did;
 * sending the end state makes the operation idempotent.
 */
export function parseActiveToggle(input: unknown): ActiveToggleInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { id, active } = input as Record<string, unknown>;
  if (!isUuid(id) || !isBoolean(active)) return null;
  return { id, active };
}

/* -------------------------------------------------------------------------- */
/* Admin: teachers                                                            */
/* -------------------------------------------------------------------------- */

export interface TeacherEditInput extends NewTeacherInput {
  teacherId: string;
}

/**
 * An edit is a new teacher's fields plus the id of the row to write them to, so
 * the field rules are reused wholesale. One definition of "a valid teacher"
 * means the admin form can never accept a value the student form would have
 * rejected, or the reverse.
 */
export function parseTeacherEdit(input: unknown): TeacherEditInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId } = input as Record<string, unknown>;
  if (!isUuid(teacherId)) return null;

  const fields = parseNewTeacher(input);
  if (!fields) return null;

  return { teacherId, ...fields };
}

export interface TeacherNoteInput {
  teacherId: string;
  note: string;
}

/**
 * A customer note, e.g. "dairy issue, use non-dairy creamer".
 *
 * Capped at a length that still fits the banner the student sees above the
 * menu. A note long enough to scroll is a note that will not be read during a
 * two-minute classroom visit, which defeats its only purpose.
 */
export function parseTeacherNote(input: unknown): TeacherNoteInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId, note } = input as Record<string, unknown>;

  if (!isUuid(teacherId)) return null;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (trimmed.length < 2 || trimmed.length > 200) return null;

  return { teacherId, note: trimmed };
}

export interface TeacherNoteRemovalInput {
  teacherId: string;
  index: number;
}

/**
 * Notes are removed by position, not by text. Two notes can legitimately read
 * the same, and deleting "the one that matches this string" would take both.
 */
export function parseTeacherNoteRemoval(
  input: unknown,
): TeacherNoteRemovalInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId, index } = input as Record<string, unknown>;

  if (!isUuid(teacherId)) return null;
  if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) {
    return null;
  }

  return { teacherId, index };
}

/* -------------------------------------------------------------------------- */
/* Admin: menu                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Converts a price the administrator typed in dollars into integer cents.
 *
 * This is the one boundary where dollars are allowed to exist, and it never
 * multiplies by 100. `parseFloat("8.20") * 100` is 819.9999999999999, and
 * rounding that is one representation change away from charging the wrong
 * price forever, because the result is snapshotted onto every future order.
 * Instead the string is split on the decimal point and the two halves are read
 * as separate integers, so the arithmetic is exact by construction.
 *
 * Accepts "3", "3.5", "3.50", "$3.50" and " 3.50 ". Rejects more than two
 * decimal places: a third digit means the typist meant something this system
 * cannot represent, and silently truncating it is how a price quietly becomes
 * wrong.
 */
export function dollarsToCents(input: unknown): number | null {
  if (typeof input === "number") {
    // Only a whole number of dollars can arrive as a number without having
    // already passed through the float representation this function exists to
    // avoid. Anything fractional is rejected rather than rounded.
    return Number.isSafeInteger(input) && input >= 0 && input <= 99_999
      ? input * 100
      : null;
  }
  if (typeof input !== "string") return null;

  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d{0,5})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, whole, fraction] = match;
  if (whole === "" && fraction === undefined) return null;

  const dollars = whole === "" ? 0 : Number.parseInt(whole, 10);
  // "3.5" means fifty cents, not five. Pad to two places before reading.
  const cents =
    fraction === undefined ? 0 : Number.parseInt(fraction.padEnd(2, "0"), 10);

  return dollars * 100 + cents;
}

/** Which of the two lists on the menu page a row belongs to. */
export type MenuKind = "item" | "addon";

function isMenuKind(value: unknown): value is MenuKind {
  return value === "item" || value === "addon";
}

export interface NewMenuEntryInput {
  kind: MenuKind;
  name: string;
  priceCents: number;
  isSpecial: boolean;
}

/**
 * A new menu item or add-on.
 *
 * `isSpecial` is accepted for both kinds but only ever written for items;
 * add-ons have no such column. Parsing it uniformly keeps the form payload one
 * shape, and the action drops it where it does not apply.
 */
export function parseNewMenuEntry(input: unknown): NewMenuEntryInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { kind, name, price, isSpecial } = input as Record<string, unknown>;

  if (!isMenuKind(kind)) return null;

  const trimmedName = parseName(name, 60);
  if (trimmedName === null) return null;

  const priceCents = dollarsToCents(price);
  if (priceCents === null || !isCents(priceCents)) return null;

  const special = isSpecial === undefined ? false : isSpecial;
  if (!isBoolean(special)) return null;

  return { kind, name: trimmedName, priceCents, isSpecial: special };
}

export interface MenuEditInput {
  kind: MenuKind;
  id: string;
  name: string;
  priceCents: number;
}

export function parseMenuEdit(input: unknown): MenuEditInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { kind, id, name, price } = input as Record<string, unknown>;

  if (!isMenuKind(kind)) return null;
  if (!isUuid(id)) return null;

  const trimmedName = parseName(name, 60);
  if (trimmedName === null) return null;

  const priceCents = dollarsToCents(price);
  if (priceCents === null || !isCents(priceCents)) return null;

  return { kind, id, name: trimmedName, priceCents };
}

export interface MenuFlagInput {
  kind: MenuKind;
  id: string;
  value: boolean;
}

/** Shared payload for the active and special switches on the menu page. */
export function parseMenuFlag(input: unknown): MenuFlagInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { kind, id, value } = input as Record<string, unknown>;

  if (!isMenuKind(kind)) return null;
  if (!isUuid(id) || !isBoolean(value)) return null;

  return { kind, id, value };
}

export interface NewAdminInput {
  name: string;
  email: string;
}

/**
 * Validates someone being given admin access.
 *
 * Unlike a teacher's, the email is required: it is how they sign in, by a
 * code sent to it. Stored lower-case, since the sign-in form lower-cases what
 * is typed there. The check is as loose as the teacher one, for the same
 * reason: a strict pattern rejects real addresses.
 */
export function parseNewAdmin(input: unknown): NewAdminInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { name, email } = input as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string") return null;

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) return null;

  const candidate = email.trim().toLowerCase();
  if (candidate.length > 120) return null;
  const at = candidate.indexOf("@");
  if (at <= 0 || at === candidate.length - 1 || candidate.includes(" ")) return null;

  return { name: trimmedName, email: candidate };
}
