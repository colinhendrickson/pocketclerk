import { NextResponse, type NextRequest } from "next/server";

import { DEVICE_COOKIE } from "@/lib/device-cookie";

/**
 * Renews the pairing cookie on every student page, so a cart iPad in daily use
 * never reaches its expiry. The value is passed through unchanged; whether it
 * is valid is still decided by src/lib/device.ts on each request.
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const paired = request.cookies.get(DEVICE_COOKIE.name)?.value;
  if (paired) response.cookies.set(DEVICE_COOKIE.name, paired, DEVICE_COOKIE.options);
  return response;
}

export const config = {
  matcher: ["/cart", "/pin/:path*", "/shift/:path*"],
};
