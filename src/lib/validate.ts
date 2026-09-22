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
