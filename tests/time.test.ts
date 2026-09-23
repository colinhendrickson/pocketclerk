import { describe, expect, it } from "vitest";

import {
  addDays,
  cartFormatter,
  DEFAULT_TIME_ZONE,
  localDate,
  parseLocalDate,
  resolveTimeZone,
  startOfLocalDay,
} from "@/lib/time";

const NY = "America/New_York";

describe("localDate", () => {
  it("reads the date in the cart's zone, not UTC", () => {
    // The moment of the first production 524: already the 23rd in UTC, still
    // the evening of the 22nd at the cart.
    const instant = new Date("2026-09-23T03:35:52Z");
    expect(localDate(instant, NY)).toBe("2026-09-22");
    expect(localDate(instant, "UTC")).toBe("2026-09-23");
  });
});

describe("startOfLocalDay", () => {
  it("is 05:00 UTC in winter", () => {
    expect(startOfLocalDay("2026-01-15", NY).toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
  });

  it("is 04:00 UTC in summer", () => {
    expect(startOfLocalDay("2026-07-15", NY).toISOString()).toBe(
      "2026-07-15T04:00:00.000Z",
    );
  });

  it("makes the day daylight saving starts 23 hours long", () => {
    // 2026-03-08: clocks jump forward at 2 AM.
    const start = startOfLocalDay("2026-03-08", NY);
    const end = startOfLocalDay(addDays("2026-03-08", 1), NY);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it("makes the day daylight saving ends 25 hours long", () => {
    // 2026-11-01: clocks fall back at 2 AM.
    const start = startOfLocalDay("2026-11-01", NY);
    const end = startOfLocalDay(addDays("2026-11-01", 1), NY);
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000);
  });

  it("is exactly midnight UTC in UTC", () => {
    expect(startOfLocalDay("2026-09-22", "UTC").toISOString()).toBe(
      "2026-09-22T00:00:00.000Z",
    );
  });

  it("round-trips: the start of a day falls on that day", () => {
    for (const date of ["2026-01-01", "2026-03-08", "2026-06-30", "2026-11-01"]) {
      expect(localDate(startOfLocalDay(date, NY), NY)).toBe(date);
    }
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("parseLocalDate", () => {
  it("accepts a real date", () => {
    expect(parseLocalDate("2026-09-22")).toBe("2026-09-22");
  });

  it("refuses dates that do not exist rather than rolling them forward", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(parseLocalDate("2026-13-01")).toBeNull();
  });

  it("refuses anything that is not YYYY-MM-DD", () => {
    expect(parseLocalDate("09/22/2026")).toBeNull();
    expect(parseLocalDate("2026-9-22")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
  });
});

describe("resolveTimeZone", () => {
  it("keeps a real zone", () => {
    expect(resolveTimeZone("America/Chicago")).toBe("America/Chicago");
  });

  it("falls back instead of taking every page down over a typo", () => {
    expect(resolveTimeZone("America/Grand_Rapids")).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("")).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
  });
});

describe("cartFormatter", () => {
  it("formats in the cart's zone regardless of the machine's", () => {
    const eightFifteen = new Date("2026-09-22T12:15:00Z");
    const time = cartFormatter({ hour: "numeric", minute: "2-digit" }, NY);
    expect(time.format(eightFifteen)).toBe("8:15 AM");
  });
});
