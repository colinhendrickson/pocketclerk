"use server";

import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import {
  clearAdminSession,
  redeemSignInCode,
  requestSignInLink,
  TOKEN_MINUTES,
} from "@/lib/admin-auth";
import { isConfigurationError } from "@/lib/config";
import { getEmailSender } from "@/providers/email";
import { renderSignInEmail } from "@/providers/renderer/sign-in";

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

    // Both ways in, in one mail. The code is for the cart's iPad, where the
    // point is that a personal mailbox never gets opened on a shared device:
    // the mail lands on a phone and only the six digits make the trip. The
    // link is for a laptop where mail is already open.
    const message = renderSignInEmail({
      name: result.identity.name,
      code: result.code,
      link,
      cartName: branding.cartName,
      programName: branding.programName,
      // A mail client has no page to resolve a relative path against, so a
      // logo configured as "/logo.png" would arrive as a broken image.
      logoUrl: branding.logoUrl ? new URL(branding.logoUrl, base).toString() : null,
      expiresMinutes: TOKEN_MINUTES,
    });

    const sent = await sender.sendText({
      to: result.identity.email,
      subject: message.subject,
      body: message.text,
      html: message.html,
    });

    // A rejected send used to vanish here. The provider returns a result rather
    // than throwing, so ignoring it meant a deployment with a bad key or an
    // unverified sender domain told the user a code was on its way, logged
    // nothing, and left no trace anywhere except the provider's own dashboard.
    //
    // It stays a log line rather than a message on the page: the send is only
    // attempted for an address that IS an administrator, so "we could not send
    // that" on screen would answer the one question the form refuses to answer.
    if (sent.ok) {
      console.info(`[sign-in] code sent via ${sender.name}`);
    } else {
      console.error(
        `[email] sign-in send failed via ${sender.name}: ${sent.error ?? "no reason given"}`,
      );
    }
  } else {
    // The page is identical on these paths, deliberately, so the log is the
    // only place the difference can show. Before this, a rate-limited request
    // produced a friendly "code on its way", no mail, and a completely empty
    // log: from the outside indistinguishable from a broken email provider,
    // and it cost a real deployment an evening to tell the two apart.
    //
    // The address is left out. The log is private to whoever deployed this,
    // but there is no reason to collect strangers' addresses in it either.
    console.warn(
      result.error === "rate_limited"
        ? "[sign-in] no code sent: rate limited, 5 per address per hour"
        : "[sign-in] no code sent: address is not on the administrator allowlist",
    );
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
