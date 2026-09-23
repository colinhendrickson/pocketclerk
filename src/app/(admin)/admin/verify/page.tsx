import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import { getAdmin } from "@/lib/admin-auth";

import { redeemLink } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Where an emailed sign-in link lands. It does not sign anyone in.
 *
 * Mail security scanners, Microsoft's Safe Links in particular and most school
 * mail sits behind it, open every link in incoming mail to inspect it. When
 * visiting this address redeemed the token, the scanner's visit used it up, and
 * the person clicking a moment later was told their link had expired. Their
 * first sign-in would fail for a reason nobody could see.
 *
 * So arriving here only shows a button, and pressing it redeems the token.
 * Scanners fetch pages; they do not submit forms. Redeeming is also a change of
 * state, which a GET request should not make anyway.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await getAdmin()) redirect("/admin");

  const { token } = await searchParams;
  if (!token) redirect("/admin/sign-in?error=1");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4 md:p-8">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-box border border-base-300 bg-base-100 p-8">
        <div>
          <p className="text-sm font-bold opacity-70">{branding.programName}</p>
          <h1 className="text-3xl font-extrabold">Finish signing in</h1>
        </div>
        <p>You opened the sign-in link from your email. One more step.</p>
        <form action={redeemLink}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary w-full">
            Sign in to {branding.cartName}
          </button>
        </form>
      </div>
    </main>
  );
}
