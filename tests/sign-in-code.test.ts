import { describe, expect, it } from "vitest";

import {
  CODE_LENGTH,
  formatSignInCode,
  newSignInCode,
  normalizeSignInCode,
} from "@/lib/sign-in-code";

describe("newSignInCode", () => {
  it("is always six digits, leading zeros kept", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(newSignInCode()).toMatch(/^\d{6}$/);
    }
  });

  it("spans the whole keyspace rather than a corner of it", () => {
    // A code built by slicing a hash or by taking a modulus tends to cluster.
    // 500 draws from a million values should collide rarely and cover both
    // halves of the range; this catches a generator that is quietly narrow.
    const codes = Array.from({ length: 500 }, newSignInCode);
    expect(new Set(codes).size).toBeGreaterThan(490);
    expect(codes.some((c) => Number(c) < 500_000)).toBe(true);
    expect(codes.some((c) => Number(c) >= 500_000)).toBe(true);
  });
});

describe("normalizeSignInCode", () => {
  it("accepts the digits as typed", () => {
    expect(normalizeSignInCode("483902")).toBe("483902");
  });

  it("accepts the code the way it was displayed", () => {
    // The code is shown grouped, so it gets copied grouped.
    expect(normalizeSignInCode("483 902")).toBe("483902");
    expect(normalizeSignInCode("483-902")).toBe("483902");
    expect(normalizeSignInCode("  483 902 ")).toBe("483902");
  });

  it("keeps leading zeros", () => {
    expect(normalizeSignInCode("004821")).toBe("004821");
  });

  it("refuses anything that is not six digits", () => {
    expect(normalizeSignInCode("48390")).toBeNull();
    expect(normalizeSignInCode("4839021")).toBeNull();
    expect(normalizeSignInCode("48390a")).toBeNull();
    expect(normalizeSignInCode("")).toBeNull();
    expect(normalizeSignInCode("      ")).toBeNull();
  });

  it("refuses digits that only look numeric", () => {
    // Arabic-Indic digits pass a naive Number() check and would then fail to
    // match a stored code, which reads as "the right code was rejected".
    expect(normalizeSignInCode("٤٨٣٩٠٢")).toBeNull();
  });
});

describe("formatSignInCode", () => {
  it("groups in threes", () => {
    expect(formatSignInCode("483902")).toBe("483 902");
    expect(formatSignInCode("004821")).toBe("004 821");
  });

  it("round-trips through normalize", () => {
    const code = newSignInCode();
    expect(normalizeSignInCode(formatSignInCode(code))).toBe(code);
    expect(code).toHaveLength(CODE_LENGTH);
  });
});
