/**
 * Input validation for server action payloads, which are untrusted. Parsers
 * return null on any invalid field. Hand-written guards rather than a library,
 * given how few shapes there are.
 */

import { isMenuIconKey, type MenuIconKey } from "@/lib/menu-icons";
import { parseLocalDate, type LocalDate } from "@/lib/time";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isFourDigitPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

/** Non-negative safe integer, the required shape of every money field. */
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

interface OrderBase {
  /** Chosen by the cart once per order, so a retry after a lost response is recognized. */
  orderId: string;
  teacherId: string;
  lines: OrderLineInput[];
}

/** Cash records the money handed over; a staff card hands over none. */
export type CompleteOrderInput =
  | (OrderBase & { paymentMethod: "cash"; receivedCents: number })
  | (OrderBase & { paymentMethod: "card"; receivedCents: null });

/** $1,000: more than any real payment, and far below the int4 column limit. */
export const MAX_RECEIVED_CENTS = 100_000;

/**
 * Validates an order completion payload. Array sizes are capped so a request
 * cannot drive an unbounded loop inside the order transaction.
 */
export function parseCompleteOrder(input: unknown): CompleteOrderInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { orderId, teacherId, paymentMethod = "cash", receivedCents, lines } = input as Record<
    string,
    unknown
  >;

  if (!isUuid(orderId) || !isUuid(teacherId)) return null;
  if (paymentMethod === "cash") {
    if (!isCents(receivedCents) || receivedCents > MAX_RECEIVED_CENTS) return null;
  } else if (paymentMethod === "card") {
    if (receivedCents !== undefined && receivedCents !== null) return null;
  } else {
    return null;
  }
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

  return paymentMethod === "cash"
    ? { orderId, teacherId, paymentMethod, receivedCents: receivedCents as number, lines: parsed }
    : { orderId, teacherId, paymentMethod, receivedCents: null, lines: parsed };
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

/** Trims a name and enforces the shared length range; whitespace-only is invalid. */
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
 * Validates a teacher added mid-shift. The email check is intentionally loose:
 * strict patterns reject valid addresses, and a typo only costs one failed
 * receipt, which the job monitor surfaces.
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
 * Payload for admin activate/deactivate buttons. `active` is the desired end
 * state rather than a server-side flip, so double-clicks and stale tabs are
 * idempotent.
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

/** A teacher edit: the new-teacher fields plus the row id, so both forms share one set of rules. */
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

/** A customer note. Capped so it fits the banner shown above the menu without scrolling. */
export function parseTeacherNote(input: unknown): TeacherNoteInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId, note } = input as Record<string, unknown>;

  if (!isUuid(teacherId)) return null;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (trimmed.length < 2 || trimmed.length > 200) return null;

  return { teacherId, note: trimmed };
}

export interface TeacherCardPreferenceInput {
  teacherId: string;
  prefersCard: boolean;
}

/** Marks a teacher who usually pays with a staff card (3.7). */
export function parseTeacherCardPreference(input: unknown): TeacherCardPreferenceInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { teacherId, prefersCard } = input as Record<string, unknown>;
  if (!isUuid(teacherId) || !isBoolean(prefersCard)) return null;
  return { teacherId, prefersCard };
}

export interface TeacherNoteRemovalInput {
  teacherId: string;
  index: number;
}

/** Notes are removed by index, not text, since two notes may be identical. */
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
 * Converts a typed dollar amount to integer cents without float math
 * (`parseFloat("8.20") * 100` is 819.999...). The whole and fractional parts
 * are parsed as separate integers. Accepts "3", "3.5", "3.50", "$3.50" and
 * surrounding whitespace; rejects more than two decimal places rather than
 * truncating. See docs/adr/0001-money-as-integer-cents.md.
 */
export function dollarsToCents(input: unknown): number | null {
  if (typeof input === "number") {
    // Only whole dollars are safe as a number; fractional values are rejected.
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
  // "3.5" is fifty cents: pad to two digits.
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

/** $99,999.99, the most the price input accepts. */
const MAX_MENU_PRICE_CENTS = 9_999_999;

/**
 * Menu prices arrive as integer cents in `priceCents`, converted client-side by
 * `dollarsToCents`. Payloads using a legacy `price` field are rejected rather
 * than guessed at, to avoid double conversion.
 */
function isMenuPrice(value: unknown): value is number {
  return isCents(value) && value <= MAX_MENU_PRICE_CENTS;
}

/** A new menu item or add-on. `isSpecial` is parsed for both but only stored for items. */
export function parseNewMenuEntry(input: unknown): NewMenuEntryInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { kind, name, priceCents, isSpecial } = input as Record<string, unknown>;

  if (!isMenuKind(kind)) return null;

  const trimmedName = parseName(name, 60);
  if (trimmedName === null) return null;

  if (!isMenuPrice(priceCents)) return null;

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
  const { kind, id, name, priceCents } = input as Record<string, unknown>;

  if (!isMenuKind(kind)) return null;
  if (!isUuid(id)) return null;

  const trimmedName = parseName(name, 60);
  if (trimmedName === null) return null;

  if (!isMenuPrice(priceCents)) return null;

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

export interface MenuIconInput {
  kind: MenuKind;
  id: string;
  icon: MenuIconKey | null;
}

/** Validates a menu picture. `icon: null` clears it; a missing `icon` is rejected. */
export function parseMenuIcon(input: unknown): MenuIconInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { kind, id, icon } = input as Record<string, unknown>;

  if (!isMenuKind(kind) || !isUuid(id)) return null;
  if (icon !== null && !isMenuIconKey(icon)) return null;

  return { kind, id, icon };
}

/* -------------------------------------------------------------------------- */
/* Admin: inventory supplies                                                  */
/* -------------------------------------------------------------------------- */

export interface SupplyInput {
  name: string;
  /** What it is counted in, e.g. "cups". Defaults to "items". */
  unit: string;
  /** How many a full cart carries; the restock target. */
  parLevel: number;
}

const MAX_PAR_LEVEL = 9_999;
const MAX_UNIT_LENGTH = 20;

export function parseNewSupply(input: unknown): SupplyInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { name, unit, parLevel } = input as Record<string, unknown>;

  const trimmedName = parseName(name, 60);
  if (trimmedName === null) return null;

  if (unit !== undefined && typeof unit !== "string") return null;
  const trimmedUnit = (unit ?? "").trim() || "items";
  if (trimmedUnit.length > MAX_UNIT_LENGTH) return null;

  if (!isPositiveIntWithin(parLevel, MAX_PAR_LEVEL)) return null;

  return { name: trimmedName, unit: trimmedUnit, parLevel };
}

export function parseSupplyEdit(input: unknown): (SupplyInput & { id: string }) | null {
  if (typeof input !== "object" || input === null) return null;
  const { id } = input as Record<string, unknown>;
  if (!isUuid(id)) return null;
  const supply = parseNewSupply(input);
  return supply ? { id, ...supply } : null;
}

export interface NewAdminInput {
  name: string;
  email: string;
}

/**
 * Validates a new admin. Email is required (it is the sign-in channel) and
 * lower-cased to match the sign-in form. Loosely checked, as for teachers.
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

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

/** What the cart spends money on. A fixed list so the ledger can be grouped. */
export const EXPENSE_CATEGORIES = [
  "product",
  "supplies",
  "equipment",
  "treat",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** $99,999.99: the dollars input allows five whole digits. */
export const MAX_EXPENSE_CENTS = 9_999_999;
const MAX_EXPENSE_NOTE_LENGTH = 200;

export interface ExpenseInput {
  spentOn: LocalDate;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  note: string | null;
}

export function parseNewExpense(input: unknown): ExpenseInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { spentOn, description, category, amountCents, note } = input as Record<string, unknown>;

  const date = typeof spentOn === "string" ? parseLocalDate(spentOn) : null;
  if (date === null) return null;

  const trimmedDescription = parseName(description, 80);
  if (trimmedDescription === null) return null;

  if (!isExpenseCategory(category)) return null;

  if (!isPositiveIntWithin(amountCents, MAX_EXPENSE_CENTS)) return null;

  if (note !== undefined && note !== null && typeof note !== "string") return null;
  const trimmedNote = (note ?? "").trim();
  if (trimmedNote.length > MAX_EXPENSE_NOTE_LENGTH) return null;

  return {
    spentOn: date,
    description: trimmedDescription,
    category,
    amountCents,
    note: trimmedNote || null,
  };
}

export function parseExpenseEdit(input: unknown): (ExpenseInput & { id: string }) | null {
  if (typeof input !== "object" || input === null) return null;
  const { id } = input as Record<string, unknown>;
  if (!isUuid(id)) return null;
  const expense = parseNewExpense(input);
  return expense ? { id, ...expense } : null;
}
