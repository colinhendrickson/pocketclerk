"use server";

import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import {
  clearAdminSession,
  redeemSignInCode,
  requestSignInLink,
} from "@/lib/admin-auth";
import { isConfigurationError } from "@/lib/config";
import { formatSignInCode } from "@/lib/sign-in-code";
import { getEmailSender } from "@/providers/email";

/**
 * Administrator sign-in actions.
 *
 * The response is identical whether or not the address belongs to an
 * administrator. A form that says "no such administrator" is a form that tells
 * a stranger who the administrators are.
 */
export async function sendSignInLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");

  let result: Awaited<ReturnType<typeof requestSignInLink>>;
  try {
    result = await requestSignInLink(email);
  } catch (error) {
    // A missing deployment variable is not a bug to hide behind a blank 500.
    // Name it in the logs and tell the person at the keyboard that the problem
    // is configuration rather than something they did.
    if (isConfigurationError(error)) {
      console.error(
        `[config] ${error.variable} is missing or invalid. Set it in the deployment environment and redeploy.`,
      );
      redirect("/admin/sign-in?error=config");
    }
    throw error;
  }

  if (result.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${base}/admin/verify?token=${result.token}`;
    const sender = getEmailSender();

    // Reuses the receipt sender. Email is a provider, so a second kind of
    // message costs one call rather than a second integration.
    // Both ways in, in one mail. The link is for a laptop, where clicking is
    // the fastest thing available. The code is for the cart's iPad, where the
    // point is that a personal mailbox never gets opened on a shared device: the
    // mail lands on a phone and only the six digits make the trip.
    const sent = await sender.sendText({
      to: result.identity.email,
      // Code first, so a phone's lock screen shows it without the mail being
      // opened at all. That is the whole point of it on a shared iPad.
      subject: `${formatSignInCode(result.code)} is your ${branding.cartName} sign-in code`,
      body: [
        `Hello ${result.identity.name},`,
        "",
        `Sign-in code:  ${formatSignInCode(result.code)}`,
        "",
        "Type that on the sign-in screen. This is the one to use on the cart's",
        "iPad, so you never have to sign into your email on it.",
        "",
        "Or, on a computer where you already have your email open, use this",
        "link instead:",
        "",
        link,
        "",
        "Either one works once and expires in 15 minutes. Asking for a new code",
        "replaces this one.",
        "",
        "If you did not ask for this, you can ignore it. Nobody can sign in",
        "without the code or the link.",
      ].join("\n"),
    });

    // A rejected send used to vanish here. The provider returns a result rather
    // than throwing, so ignoring it meant a deployment with a bad key or an
    // unverified sender domain told the user a code was on its way, logged
    // nothing, and left no trace anywhere except the provider's own dashboard.
    //
    // It stays a log line rather than a message on the page: the send is only
    // attempted for an address that IS an administrator, so "we could not send
    // that" on screen would answer the one question the form refuses to answer.
    if (!sent.ok) {
      console.error(
        `[email] sign-in send failed via ${sender.name}: ${sent.error ?? "no reason given"}`,
      );
    }
  }

  // The address comes back with the redirect so the code form knows whose code
  // it is checking. It is the address they just typed, not a secret, and the
  // page says the same thing whether or not it belongs to an administrator.
  const query = new URLSearchParams({ sent: "1", email: email.trim() });
  redirect(`/admin/sign-in?${query}`);
}

/**
 * Signs in with the code from the email.
 *
 * A server action rather than a route handler, because the code arrives by POST
 * and never belongs in a URL: an address bar on a shared iPad is the one place
 * a still-live secret should not be left sitting.
 */
export async function signInWithCode(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  let result: Awaited<ReturnType<typeof redeemSignInCode>>;
  try {
    result = await redeemSignInCode(email, code);
  } catch (error) {
    if (isConfigurationError(error)) {
      console.error(
        `[config] ${error.variable} is missing or invalid. Set it in the deployment environment and redeploy.`,
      );
      redirect("/admin/sign-in?error=config");
    }
    throw error;
  }

  if (result.ok) redirect("/admin");

  const failed = new URLSearchParams({
    sent: "1",
    email: email.trim(),
    error: result.error === "too_many" ? "attempts" : "code",
  });
  redirect(`/admin/sign-in?${failed}`);
}


export async function signOut(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/sign-in");
}
