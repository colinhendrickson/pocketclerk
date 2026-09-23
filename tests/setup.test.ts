import { afterAll, describe, expect, it } from "vitest";

import { getClient } from "@/db";
import { getSetupCounts, setupChecklist, setupComplete, type SetupCounts } from "@/lib/setup";

/**
 * The setup checklist's rules, and the query behind them.
 */

const empty: SetupCounts = {
  activeStudents: 0,
  activeTeachers: 0,
  teachersWithEmail: 0,
  activeMenuItems: 0,
  shifts: 0,
  orders: 0,
  admins: 1,
};

const ready: SetupCounts = {
  activeStudents: 6,
  activeTeachers: 12,
  teachersWithEmail: 12,
  activeMenuItems: 5,
  shifts: 1,
  orders: 1,
  admins: 1,
};

function step(counts: SetupCounts, id: string) {
  return setupChecklist(counts).find((s) => s.id === id)!;
}

describe("setupChecklist", () => {
  it("has nothing done on a fresh install, and says so in words", () => {
    const steps = setupChecklist(empty);
    expect(steps.filter((s) => s.done)).toEqual([]);
    expect(step(empty, "students").status).toBe("No students yet");
    expect(setupComplete(steps)).toBe(false);
  });

  it("is complete when everything required is done, even with one admin", () => {
    const steps = setupChecklist(ready);
    expect(setupComplete(steps)).toBe(true);
    expect(step(ready, "admins")).toMatchObject({ done: false, optional: true });
  });

  it("keeps teachers unfinished while any active teacher has no email", () => {
    const counts = { ...ready, teachersWithEmail: 10 };
    expect(step(counts, "teachers")).toMatchObject({
      done: false,
      status: "2 of 12 teachers have no email",
    });
    expect(setupComplete(setupChecklist(counts))).toBe(false);
  });

  it("counts the iPad as connected once anyone has clocked in", () => {
    expect(step({ ...empty, shifts: 1 }, "ipad").done).toBe(true);
  });

  it("uses the singular for one", () => {
    expect(step({ ...ready, activeStudents: 1 }, "students").status).toBe("1 student");
    expect(step({ ...ready, activeTeachers: 1, teachersWithEmail: 0 }, "teachers").status).toBe(
      "1 of 1 teacher has no email",
    );
  });
});

describe("getSetupCounts", () => {
  afterAll(async () => {
    await getClient().end();
  });

  it("reads every count from the database", async () => {
    const counts = await getSetupCounts();
    for (const value of Object.values(counts)) expect(Number.isInteger(value)).toBe(true);
    expect(counts.admins).toBeGreaterThan(0);
    expect(counts.teachersWithEmail).toBeLessThanOrEqual(counts.activeTeachers);
  });
});
