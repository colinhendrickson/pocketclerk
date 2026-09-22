import { NextResponse } from "next/server";

import { codeMatches, pairDevice, pairingRequired } from "@/lib/device";

export const dynamic = "force-dynamic";

/**
 * Pairs this device with the cart.
 *
 * A route handler rather than a page, because pairing sets a cookie and Next.js
 * only permits that in an action or a route handler.
 *
 * The response is identical for a correct and an incorrect code, apart from
 * whether the cookie is set, so the endpoint cannot be used to test guesses by
 * watching what comes back. Guessing is impractical anyway against a code of
 * real length, and the code is typed once per device by an adult.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  if (!pairingRequired()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const code = url.searchParams.get("code") ?? "";
  if (code && codeMatches(code)) {
    await pairDevice();
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(new URL("/not-set-up", request.url));
}
