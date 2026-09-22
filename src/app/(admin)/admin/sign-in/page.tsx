import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import { getAdmin } from "@/lib/admin-auth";

import { sendSignInLink } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Administrator sign-in.
 *
 * Both halves of the flow live on one route: the form that asks for an address,
 * and the landing place for the link that arrives by email. A single route
 * means the link has one shape and nothing to get wrong in an email client.
 */
export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Redeeming a link happens in /admin/verify, which is a route handler because
  // setting a session cookie is not permitted while a page renders.
  if (await getAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-box border border-base-300 bg-base-100 p-8">
        <div>
          <p className="text-sm font-bold opacity-70">{branding.programName}</p>
          <h1 className="text-3xl font-extrabold">Administrator sign-in</h1>
        </div>

        {params.sent ? (
          <p role="status" className="alert alert-success rounded-box">
            If that address belongs to an administrator, a sign-in link is on its
            way. It works once and expires in 15 minutes.
          </p>
        ) : null}

        {params.error ? (
          <p role="alert" className="alert alert-warning rounded-box">
            That link has expired or has already been used. Request another.
          </p>
        ) : null}

        <form action={sendSignInLink} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-bold">Email address</span>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input input-bordered"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Email me a sign-in link
          </button>
        </form>

        <p className="text-sm opacity-70">
          There is no password. Access is controlled by an allowlist, so only
          addresses that have been added can sign in.
        </p>
      </div>
    </main>
  );
}
