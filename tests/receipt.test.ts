import { describe, expect, it } from "vitest";

import { encodeReceipt } from "@/providers/printer/web-bluetooth";
import {
  RECEIPT_WIDTH,
  renderReceiptText,
  type Receipt,
} from "@/providers/renderer/receipt";

const receipt: Receipt = {
  programName: "Maple Grove Learning Program",
  cartName: "Sunrise Snack Cart",
  teacherName: "Mrs. Smith",
  room: "114",
  studentName: "Maya",
  placedAt: new Date("2026-09-03T14:15:00Z"),
  lines: [
    { name: "Coffee", qty: 2, amountCents: 200 },
    { name: "Non-dairy creamer", qty: 1, amountCents: 0, isAddon: true },
  ],
  totalCents: 200,
  receivedCents: 500,
  changeCents: 300,
};

describe("renderReceiptText", () => {
  const text = renderReceiptText(receipt);
  const lines = text.split("\n");

  it("never exceeds the paper width", () => {
    // 58mm paper is 32 characters. A line that overflows wraps on the printer
    // and puts an amount on its own line, which looks like a mistake.
    for (const line of lines) {
      expect(line.length, `"${line}"`).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });

  it("shows the totals a customer needs to check the maths", () => {
    expect(text).toContain("TOTAL");
    expect(text).toMatch(/TOTAL\s+\$2\.00/);
    expect(text).toMatch(/Paid\s+\$5\.00/);
    expect(text).toMatch(/Change\s+\$3\.00/);
  });

  it("identifies the customer, the student and the time", () => {
    expect(text).toContain("Mrs. Smith");
    expect(text).toContain("114");
    expect(text).toContain("Maya");
    expect(text).toContain("9/3/2026");
  });

  it("carries the branding from config rather than hard-coded names", () => {
    expect(text).toContain("MAPLE GROVE LEARNING PROGRAM");
    expect(text).toContain("SUNRISE SNACK CART");
  });

  it("indents add-ons under their item", () => {
    const addonLine = lines.find((l) => l.includes("Non-dairy creamer"));
    expect(addonLine?.startsWith("  ")).toBe(true);
  });

  it("keeps the amount intact when a name is too long to fit", () => {
    const long = renderReceiptText({
      ...receipt,
      lines: [
        {
          name: "Extremely large hot chocolate with everything on it",
          qty: 1,
          amountCents: 12345,
        },
      ],
    });
    expect(long).toContain("$123.45");
    for (const line of long.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });
});

describe("encodeReceipt", () => {
  const bytes = encodeReceipt(receipt);

  it("starts with the ESC/POS initialize command", () => {
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it("ends with a feed and a cut", () => {
    const tail = Array.from(bytes.slice(-6));
    expect(tail).toEqual([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x01]);
  });

  it("contains the rendered text", () => {
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toContain("Mrs. Smith");
    expect(decoded).toContain("$3.00");
  });
});
