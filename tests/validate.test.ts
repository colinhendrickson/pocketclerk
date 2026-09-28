import { describe, expect, it } from "vitest";

import {
  dollarsToCents,
  MAX_RECEIVED_CENTS,
  parseCompleteOrder,
  parseMenuEdit,
  parseNewMenuEntry,
  parseNewTeacher,
} from "@/lib/validate";

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
    orderId: "0b6d4c1e-3a7f-4f5e-9a2b-8c1d2e3f4a5b",
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

  it("requires a uuid order id, so a retried order is recognized", () => {
    const withoutId: Record<string, unknown> = { ...valid };
    delete withoutId.orderId;
    expect(parseCompleteOrder(withoutId)).toBeNull();
    expect(parseCompleteOrder({ ...valid, orderId: "order-1" })).toBeNull();
  });

  it("caps money received, so a huge amount is refused instead of overflowing the column", () => {
    expect(parseCompleteOrder({ ...valid, receivedCents: MAX_RECEIVED_CENTS })).not.toBeNull();
    expect(parseCompleteOrder({ ...valid, receivedCents: MAX_RECEIVED_CENTS + 1 })).toBeNull();
    expect(parseCompleteOrder({ ...valid, receivedCents: 2 ** 31 })).toBeNull();
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

/**
 * The admin price field is the only place in the application where a human
 * types dollars, so it gets the same disproportionate coverage the change
 * calculation does. A price parsed one cent wrong is snapshotted onto every
 * future order and only noticed when the drawer does not balance.
 */
describe("dollarsToCents", () => {
  it("reads the obvious shapes", () => {
    expect(dollarsToCents("1.50")).toBe(150);
    expect(dollarsToCents("3")).toBe(300);
    expect(dollarsToCents("0")).toBe(0);
    expect(dollarsToCents("0.00")).toBe(0);
  });

  it("treats one decimal place as tenths of a dollar, not cents", () => {
    expect(dollarsToCents("3.5")).toBe(350);
    expect(dollarsToCents(".5")).toBe(50);
  });

  it("tolerates what a person actually types", () => {
    expect(dollarsToCents("$3.50")).toBe(350);
    expect(dollarsToCents(" 3.50 ")).toBe(350);
    expect(dollarsToCents("1,250.99")).toBe(125099);
  });

  it("is exact where multiplying a float is not", () => {
    // parseFloat("8.20") * 100 is 819.9999999999999.
    expect(dollarsToCents("8.20")).toBe(820);
    expect(dollarsToCents("0.29")).toBe(29);
    expect(dollarsToCents("1.15")).toBe(115);
    expect(dollarsToCents("2.675")).toBeNull();
  });

  it("refuses a third decimal place instead of rounding it away", () => {
    expect(dollarsToCents("1.005")).toBeNull();
  });

  it("refuses anything that is not a price", () => {
    for (const bad of ["-1", "abc", "", ".", "1.", "1.2.3", "1e2", null, undefined, {}]) {
      expect(dollarsToCents(bad)).toBeNull();
    }
  });

  it("accepts a whole number of dollars but never a float", () => {
    expect(dollarsToCents(3)).toBe(300);
    expect(dollarsToCents(3.5)).toBeNull();
    expect(dollarsToCents(-3)).toBeNull();
  });
});

/**
 * The menu page converts the typed dollars to cents in the browser and sends
 * integer cents as `priceCents`. These payloads are exactly what it sends.
 *
 * It used to send cents as `price`, which the server read as dollars and
 * multiplied by 100 again: a coffee typed as 1.00 was saved at $100.00, and
 * editing it back to 1.00 saved $100.00 again. The parser tests passed dollar
 * strings, which the page never sent, so none of them saw it.
 */
describe("parseNewMenuEntry", () => {
  it("keeps the price the page sends, in cents", () => {
    expect(parseNewMenuEntry({ kind: "item", name: "Coffee", priceCents: 100 })).toEqual({
      kind: "item",
      name: "Coffee",
      priceCents: 100,
      isSpecial: false,
    });
    expect(parseNewMenuEntry({ kind: "item", name: "Cocoa", priceCents: 125 })?.priceCents).toBe(125);
  });

  it("allows a free add-on, which must not move a total", () => {
    expect(parseNewMenuEntry({ kind: "addon", name: "Cream", priceCents: 0 })).toEqual({
      kind: "addon",
      name: "Cream",
      priceCents: 0,
      isSpecial: false,
    });
  });

  it("rejects an unknown list, a short name and a price that is not whole cents", () => {
    expect(parseNewMenuEntry({ kind: "drink", name: "Cocoa", priceCents: 100 })).toBeNull();
    expect(parseNewMenuEntry({ kind: "item", name: " C ", priceCents: 100 })).toBeNull();
    for (const bad of [1.5, -100, "100", "1.00", null, undefined, Number.NaN, 10_000_001]) {
      expect(parseNewMenuEntry({ kind: "item", name: "Cocoa", priceCents: bad }), String(bad)).toBeNull();
    }
  });

  it("refuses the old `price` field rather than guess whether it is dollars or cents", () => {
    expect(parseNewMenuEntry({ kind: "item", name: "Coffee", price: 100 })).toBeNull();
    expect(parseNewMenuEntry({ kind: "item", name: "Coffee", price: "1.00" })).toBeNull();
  });
});

describe("parseMenuEdit", () => {
  const id = "4f1c2b8e-6a5d-4c3b-9e2f-1a2b3c4d5e6f";

  it("keeps the edited price the page sends, in cents", () => {
    expect(parseMenuEdit({ kind: "item", id, name: "Coffee", priceCents: 100 })).toEqual({
      kind: "item",
      id,
      name: "Coffee",
      priceCents: 100,
    });
  });

  it("rejects a price that is not whole cents, and the old field", () => {
    expect(parseMenuEdit({ kind: "item", id, name: "Coffee", priceCents: 1.5 })).toBeNull();
    expect(parseMenuEdit({ kind: "item", id, name: "Coffee", price: 100 })).toBeNull();
  });
});
