import { NextResponse } from "next/server";

import { redeemSignInLink } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Where an emailed sign-in link lands.
 *
 * A route handler rather than a page, because redeeming the link sets a session
 * cookie and Next.js only permits that in an action or a route handler. A page
 * that tried would render a 500 the first time anyone clicked their link, which
 * is exactly what happened before this existed.
 *
 * Redeeming is a side effect, so it belongs on its own endpoint anyway: the
 * browser lands here, the cookie is set, and the user is sent onward. Nothing
 * about the token survives in the address bar.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/admin/sign-in?error=1", request.url));
  }

  const identity = await redeemSignInLink(token);
  return NextResponse.redirect(
    new URL(identity ? "/admin" : "/admin/sign-in?error=1", request.url),
  );
}
