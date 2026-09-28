import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { DEVICE_COOKIE } from "@/lib/device-cookie";
import { proxy } from "@/proxy";

/**
 * The cart's pairing cookie is renewed whenever a student screen is opened, so
 * an iPad in daily use never reaches the one-year expiry mid-school-year.
 */

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("pairing renewal", () => {
  it("renews the pairing cookie for another year", () => {
    const response = proxy(request("/cart", `${DEVICE_COOKIE.name}=signed-value`));
    const renewed = response.cookies.get(DEVICE_COOKIE.name);
    expect(renewed?.value).toBe("signed-value");
    expect(renewed?.maxAge).toBe(DEVICE_COOKIE.options.maxAge);
    expect(renewed?.httpOnly).toBe(true);
  });

  it("sets nothing on a device that was never paired", () => {
    const response = proxy(request("/cart"));
    expect(response.cookies.get(DEVICE_COOKIE.name)).toBeUndefined();
  });
});
