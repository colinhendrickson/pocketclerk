import { redirect } from "next/navigation";

import { PRODUCT_NAME } from "@/lib/site-mode";
import { getAdmin } from "@/lib/admin-auth";

import { redeemLink } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Landing page for an emailed sign-in link. It does not redeem the token on
 * GET: mail security scanners (e.g. Safe Links) prefetch links and would spend
 * it. Redemption happens only when the button POSTs the form. See
 * docs/adr/0007-self-hosted-sign-in-links.md.
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
          <p className="text-sm font-bold opacity-70">{PRODUCT_NAME}</p>
          <h1 className="text-3xl font-extrabold">Finish signing in</h1>
        </div>
        <p>You opened the sign-in link from your email. One more step.</p>
        <form action={redeemLink}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
