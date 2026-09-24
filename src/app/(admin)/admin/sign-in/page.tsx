import { redirect } from "next/navigation";

import { PRODUCT_NAME } from "@/lib/site-mode";
import { getAdmin } from "@/lib/admin-auth";

import { sendSignInLink, signInWithCode } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Administrator sign-in.
 *
 * Two steps on one route: ask for an address, then take the code that was
 * mailed to it. A single route means the emailed link has one shape and there
 * is nothing for a mail client to get wrong.
 *
 * The code is the primary path, not a fallback. Signing in happens on the
 * cart's iPad as often as on a laptop, and that iPad is a shared, student-facing
 * device: opening a personal mailbox on it to read one link would leave the
 * mailbox signed in behind you. The mail goes to a phone; six digits make the
 * trip. The link is still there for a computer where mail is already open.
 */
export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string; error?: string }>;
}) {
  const params = await searchParams;

  // An emailed link lands on /admin/verify, which shows a button rather than
  // redeeming on arrival, so a mail scanner's visit cannot spend the token.
  if (await getAdmin()) redirect("/admin");

  const awaitingCode = Boolean(params.sent);
  const email = params.email ?? "";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4 md:p-8">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-box border border-base-300 bg-base-100 p-8">
        <div>
          <p className="text-sm font-bold opacity-70">{PRODUCT_NAME}</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Administrator sign-in</h1>
        </div>

        {params.error === "config" ? (
          <p role="alert" className="alert alert-error rounded-box">
            This site is not finished being set up, so sign-in cannot work yet.
            Whoever deployed it needs to check the server logs, which name the
            missing setting.
          </p>
        ) : params.error === "attempts" ? (
          <p role="alert" className="alert alert-warning rounded-box">
            Too many wrong codes. Ask for a new one below.
          </p>
        ) : params.error === "code" ? (
          <p role="alert" className="alert alert-warning rounded-box">
            That code is not right, or it has expired. Check the newest email, or
            ask for a new code.
          </p>
        ) : params.error ? (
          <p role="alert" className="alert alert-warning rounded-box">
            That link has expired or has already been used. Request another.
          </p>
        ) : null}

        {awaitingCode ? (
          <>
            <p role="status" className="alert alert-success rounded-box">
              If that address belongs to an administrator, a code is on its way.
              It works once and expires in 15 minutes.
            </p>

            <form action={signInWithCode} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={email} />
              <label className="flex flex-col gap-2">
                <span className="font-bold">Code from the email</span>
                <input
                  id="admin-code"
                  name="code"
                  // Brings up the numeric keypad on the iPad and lets the phone
                  // offer the code it just saw in the mail.
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  placeholder="000 000"
                  className="input input-bordered w-full text-center text-2xl font-extrabold tracking-[0.3em] tabular"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Sign in
              </button>
            </form>

            <p className="text-sm opacity-70">
              The email also has a link, which does the same thing on a computer
              where your mail is already open. On the cart&rsquo;s iPad, use the
              code: there is no reason to sign a mailbox into a device the
              students use.
            </p>

            <form action={sendSignInLink}>
              <input type="hidden" name="email" value={email} />
              <button type="submit" className="btn btn-ghost btn-sm w-full">
                Send a new code
              </button>
            </form>
          </>
        ) : (
          <>
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
                Email me a sign-in code
              </button>
            </form>

            <p className="text-sm opacity-70">
              There is no password. We email a six-digit code, which you type
              here, so you never have to open your email on the cart&rsquo;s
              iPad. Access is controlled by an allowlist, so only addresses that
              have been added can sign in.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
