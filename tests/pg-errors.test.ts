import { describe, expect, it } from "vitest";

import { isUniqueViolation, pgError, violated } from "@/lib/pg-errors";

/**
 * These look trivial, and they guard a mistake this codebase already made: the
 * clock-in resume path read the SQLSTATE off the wrapped error instead of its
 * cause, matched nothing, and turned a handled case into a 500 in front of a
 * student.
 */
const wrapped = (code: string, constraint?: string) =>
  Object.assign(new Error("Failed query: insert into ..."), {
    cause: { code, constraint_name: constraint },
  });

describe("pgError", () => {
  it("reads the detail from the wrapped cause, not the outer error", () => {
    expect(pgError(wrapped("23505", "students_active_name_key"))).toEqual({
      code: "23505",
      constraint_name: "students_active_name_key",
    });
  });

  it("returns null for an error that did not come from the driver", () => {
    expect(pgError(new Error("something else"))).toBeNull();
    expect(pgError(null)).toBeNull();
    expect(pgError({ code: "23505" })).toBeNull();
  });
});

describe("violated", () => {
  it("matches only the named constraint", () => {
    const error = wrapped("23505", "menu_items_single_special_key");
    expect(violated(error, "menu_items_single_special_key")).toBe(true);
    expect(violated(error, "students_active_name_key")).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("distinguishes a unique violation from a check violation", () => {
    expect(isUniqueViolation(wrapped("23505"))).toBe(true);
    expect(isUniqueViolation(wrapped("23514"))).toBe(false);
  });
});
