import { inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { shifts, students } from "@/db/schema";
import { hashPin } from "@/lib/auth";
import {
  MAX_CREW,
  listNames,
  nextAtRegister,
  othersWorking,
  parseCrew,
  serializeCrew,
  withShift,
  withoutShift,
} from "@/lib/crew";
import { listCrew } from "@/lib/queries";
import { clockOutShift } from "@/lib/shifts";

/**
 * Several students on one shift (ticket 4.21). Each keeps their own shift, so
 * hours stay per student; the crew is the set of them clocked in on one iPad.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("the crew cookie", () => {
  it("round-trips shift ids", () => {
    expect(parseCrew(serializeCrew([A, B]))).toEqual([A, B]);
  });

  it("drops junk, duplicates and an empty cookie", () => {
    expect(parseCrew(`${A},not-a-uuid,,${A},${B}`)).toEqual([A, B]);
    expect(parseCrew("")).toEqual([]);
    expect(parseCrew(null)).toEqual([]);
  });

  it("adds a worker without replacing anyone", () => {
    expect(withShift([A], B)).toEqual([A, B]);
    expect(withShift([A, B], A)).toEqual([A, B]);
  });

  it("stays bounded, dropping the oldest", () => {
    const many = Array.from({ length: MAX_CREW + 3 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    const crew = withShift([], ...many);
    expect(crew).toHaveLength(MAX_CREW);
    expect(crew.at(-1)).toBe(many.at(-1));
  });

  it("removes one worker", () => {
    expect(withoutShift([A, B, C], B)).toEqual([A, C]);
  });
});

describe("who is left when someone leaves", () => {
  const crew = [
    { id: A, clockIn: new Date("2026-03-10T13:00:00Z") },
    { id: B, clockIn: new Date("2026-03-10T12:00:00Z") },
    { id: C, clockIn: new Date("2026-03-10T14:00:00Z") },
  ];

  it("hands the register to whoever has worked longest", () => {
    expect(nextAtRegister(crew, A)?.id).toBe(B);
    expect(nextAtRegister(crew, B)?.id).toBe(A);
  });

  it("is nobody when the last student leaves, so they close the cart", () => {
    expect(nextAtRegister([crew[0]], A)).toBeNull();
    expect(othersWorking([crew[0]], A)).toEqual([]);
  });

  it("names the others the way a student would say them", () => {
    expect(listNames(["Sam"])).toBe("Sam");
    expect(listNames(["Sam", "Jo"])).toBe("Sam and Jo");
    expect(listNames(["Sam", "Jo", "Ari"])).toBe("Sam, Jo and Ari");
  });
});

describe("listCrew", () => {
  const ZONE = "America/New_York";
  const NOW = new Date("2026-03-10T16:00:00Z");
  const studentIds: string[] = [];

  async function addStudent(name: string): Promise<string> {
    const [row] = await db.execute<{ id: string }>(
      sql`INSERT INTO students (display_name, pin_hash)
          VALUES (${`${name} ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
    );
    studentIds.push(row.id);
    return row.id;
  }

  async function openShiftAt(studentId: string, clockIn: Date): Promise<string> {
    const [row] = await db.execute<{ id: string }>(
      sql`INSERT INTO shifts (student_id, clock_in)
          VALUES (${studentId}, ${clockIn.toISOString()}::timestamptz) RETURNING id`,
    );
    return row.id;
  }

  beforeAll(async () => {
    await addStudent("Crew One");
    await addStudent("Crew Two");
    await addStudent("Crew Three");
  });

  afterEach(async () => {
    await db.delete(shifts).where(inArray(shifts.studentId, studentIds));
  });

  afterAll(async () => {
    await db.delete(students).where(inArray(students.id, studentIds));
    await getClient().end();
  });

  it("lets two students be clocked in at once, each on their own shift", async () => {
    const first = await openShiftAt(studentIds[0], new Date("2026-03-10T14:00:00Z"));
    const second = await openShiftAt(studentIds[1], new Date("2026-03-10T14:30:00Z"));

    const crew = await listCrew([first, second], NOW, ZONE);
    expect(crew.map((member) => member.id)).toEqual([first, second]);

    // One leaving is paid for their own time and leaves the other working.
    const closed = await clockOutShift(first, new Date("2026-03-10T15:00:00Z"), ZONE);
    expect(closed?.hoursHundredths).toBe(100);
    const after = await listCrew([first, second], NOW, ZONE);
    expect(after.map((member) => member.id)).toEqual([second]);

    const last = await clockOutShift(second, NOW, ZONE);
    expect(last?.hoursHundredths).toBe(150);
  });

  it("orders the crew longest-working first and drops shifts from an earlier day", async () => {
    const late = await openShiftAt(studentIds[0], new Date("2026-03-10T15:00:00Z"));
    const early = await openShiftAt(studentIds[1], new Date("2026-03-10T13:00:00Z"));
    const forgotten = await openShiftAt(studentIds[2], new Date("2026-03-07T15:00:00Z"));

    const crew = await listCrew([late, early, forgotten], NOW, ZONE);
    expect(crew.map((member) => member.id)).toEqual([early, late]);
  });

  it("is empty for no ids, without a query", async () => {
    expect(await listCrew([], NOW, ZONE)).toEqual([]);
  });
});
