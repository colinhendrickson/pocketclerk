import { afterEach, describe, expect, it } from "vitest";

import { PRODUCT_NAME, siteMode } from "@/lib/site-mode";

/**
 * Which kind of copy this is. Anything but an exact "demo" is a school's copy,
 * so a typo can never switch a school into demo mode.
 */

const original = process.env.NEXT_PUBLIC_SITE_MODE;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_MODE;
  else process.env.NEXT_PUBLIC_SITE_MODE = original;
});

describe("siteMode", () => {
  it("is a school's copy unless told otherwise", () => {
    delete process.env.NEXT_PUBLIC_SITE_MODE;
    expect(siteMode()).toBe("instance");
    process.env.NEXT_PUBLIC_SITE_MODE = "instance";
    expect(siteMode()).toBe("instance");
  });

  it("is the demo only for exactly 'demo'", () => {
    process.env.NEXT_PUBLIC_SITE_MODE = "demo";
    expect(siteMode()).toBe("demo");
    for (const almost of ["Demo", " demo", "demo ", "yes", "true"]) {
      process.env.NEXT_PUBLIC_SITE_MODE = almost;
      expect(siteMode(), almost).toBe("instance");
    }
  });

  it("names the product", () => {
    expect(PRODUCT_NAME).toBe("PocketClerk");
  });
});
