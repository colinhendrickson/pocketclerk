import { NextResponse } from "next/server";

import { codeMatches, pairDevice, pairingRequired } from "@/lib/device";

export const dynamic = "force-dynamic";

/**
 * Pairs this device with the cart. A route handler because it sets a cookie.
 * See docs/adr/0010-device-pairing.md.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  if (!pairingRequired()) {
    return NextResponse.redirect(new URL("/cart", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  if (code && codeMatches(code)) {
    await pairDevice();
    return NextResponse.redirect(new URL("/cart", request.url));
  }

  return NextResponse.redirect(new URL("/not-set-up", request.url));
}
