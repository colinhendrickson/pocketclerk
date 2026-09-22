import { describe, expect, it } from "vitest";

import { parseCompleteOrder, parseNewTeacher } from "@/lib/validate";

/**
 * The trust boundary. These run on whatever the browser chose to send, so the
 * interesting cases are the malicious and the malformed, not the happy path.
 */

describe("parseNewTeacher", () => {
  it("accepts a name on its own", () => {
    expect(parseNewTeacher({ name: "Mrs. Smith" })).toEqual({
      name: "Mrs. Smith",
      room: null,
      email: null,
    });
  });

  it("trims and lowercases the email", () => {
    const parsed = parseNewTeacher({
      name: "Mr. Jones",
      room: " 114 ",
      email: "  Teacher@Example.EDU ",
    });
    expect(parsed).toEqual({
      name: "Mr. Jones",
      room: "114",
      email: "teacher@example.edu",
    });
  });

  it("treats empty optional fields as absent", () => {
    expect(parseNewTeacher({ name: "Ms. Diaz", room: "", email: "" })).toEqual({
      name: "Ms. Diaz",
      room: null,
      email: null,
    });
  });

  it("rejects a name that is too short to be one", () => {
    expect(parseNewTeacher({ name: "A" })).toBeNull();
    expect(parseNewTeacher({ name: "   " })).toBeNull();
  });

  it("rejects an address with no recipient or no domain", () => {
    expect(parseNewTeacher({ name: "Mrs. Smith", email: "nope" })).toBeNull();
    expect(parseNewTeacher({ name: "Mrs. Smith", email: "@example.edu" })).toBeNull();
    expect(parseNewTeacher({ name: "Mrs. Smith", email: "teacher@" })).toBeNull();
  });

  it("rejects non-string fields", () => {
    expect(parseNewTeacher({ name: 42 })).toBeNull();
    expect(parseNewTeacher({ name: "Mrs. Smith", room: {} })).toBeNull();
    expect(parseNewTeacher(null)).toBeNull();
  });
});

describe("parseCompleteOrder", () => {
  const uuid = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
  const valid = {
    teacherId: uuid,
    receivedCents: 500,
    lines: [{ menuItemId: uuid, qty: 2, addonIds: [] }],
  };

  it("accepts a well-formed order", () => {
    expect(parseCompleteOrder(valid)).toEqual(valid);
  });

  it("rejects an id that is not a uuid", () => {
    expect(parseCompleteOrder({ ...valid, teacherId: "'; DROP TABLE orders --" }))
      .toBeNull();
  });

  it("rejects fractional or negative money", () => {
    expect(parseCompleteOrder({ ...valid, receivedCents: 12.5 })).toBeNull();
    expect(parseCompleteOrder({ ...valid, receivedCents: -100 })).toBeNull();
  });

  it("rejects an empty order", () => {
    expect(parseCompleteOrder({ ...valid, lines: [] })).toBeNull();
  });

  it("caps the number of lines, so the transaction loop is bounded", () => {
    const many = Array.from({ length: 21 }, () => ({
      menuItemId: uuid,
      qty: 1,
      addonIds: [],
    }));
    expect(parseCompleteOrder({ ...valid, lines: many })).toBeNull();
  });

  it("rejects a quantity that is zero, negative or absurd", () => {
    for (const qty of [0, -1, 999]) {
      expect(
        parseCompleteOrder({ ...valid, lines: [{ menuItemId: uuid, qty, addonIds: [] }] }),
      ).toBeNull();
    }
  });
});
