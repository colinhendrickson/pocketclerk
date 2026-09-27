"use server";

import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import {
  clearAdminSession,
  redeemSignInCode,
  redeemSignInLink,
  requestSignInLink,
  TOKEN_MINUTES,
} from "@/lib/admin-auth";
import { isConfigurationError } from "@/lib/config";
import { getEmailSender } from "@/providers/email";
import { renderSignInEmail } from "@/providers/renderer/sign-in";

/**
 * Runs `fn`, turning a configuration error (a missing or invalid deployment
 * variable) into a logged message and a redirect to the sign-in page's config
 * error. Everything else, including Next.js redirect/notFound signals, is
 * rethrown unchanged.
 */
async function redirectOnConfigError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isConfigurationError(error)) {
      console.error(
        `[config] ${error.variable} is missing or invalid. Set it in the deployment environment and redeploy.`,
      );
      redirect("/admin/sign-in?error=config");
    }
    throw error;
  }
}

/**
 * Emails a sign-in code and link to an administrator.
 *
 * The response is identical whether or not the address belongs to an
 * administrator, so the form cannot be used to enumerate administrators. Send
 * failures and skipped sends are only logged, never shown, for the same reason.
 */
export async function sendSignInLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");

  const result = await redirectOnConfigError(() => requestSignInLink(email));

  if (result.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${base}/admin/verify?token=${result.token}`;
    const sender = getEmailSender();

    // The code is for shared devices, where a personal mailbox should not be
    // opened; the link is for a computer where mail is already open.
    const message = renderSignInEmail({
      name: result.identity.name,
      code: result.code,
      link,
      cartName: branding.cartName,
      programName: branding.programName,
      // Mail clients cannot resolve relative URLs, so make the logo absolute.
      logoUrl: new URL(branding.logoUrl ?? "/icon-192.png", base).toString(),
      expiresMinutes: TOKEN_MINUTES,
    });

    const sent = await sender.sendText({
      to: result.identity.email,
      subject: message.subject,
      body: message.text,
      html: message.html,
    });

    // The provider returns a result rather than throwing, so log failures
    // explicitly.
    if (sent.ok) {
      console.info(`[sign-in] code sent via ${sender.name}`);
    } else {
      console.error(
        `[email] sign-in send failed via ${sender.name}: ${sent.error ?? "no reason given"}`,
      );
    }
  } else {
    // The page is identical on every path, so the log is the only place to
    // tell these apart. The address is intentionally not logged.
    console.warn(
      result.error === "rate_limited"
        ? "[sign-in] no code sent: rate limited, 5 per address per hour"
        : "[sign-in] no code sent: address is not on the administrator allowlist",
    );
  }

  // The code form needs the address it is checking; it is not a secret.
  const query = new URLSearchParams({ sent: "1", email: email.trim() });
  redirect(`/admin/sign-in?${query}`);
}

/**
 * Signs in with the code from the email. A POST-only server action so the
 * code never appears in a URL on a shared device.
 */
export async function signInWithCode(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await redirectOnConfigError(() => redeemSignInCode(email, code));

  if (result.ok) redirect("/admin");

  const failed = new URLSearchParams({
    sent: "1",
    email: email.trim(),
    error: result.error === "too_many" ? "attempts" : "code",
  });
  redirect(`/admin/sign-in?${failed}`);
}

/**
 * Redeems an emailed link from the button on /admin/verify. Redemption is a
 * POST, not the link's GET, so mail scanners that prefetch links cannot spend
 * the token. See docs/adr/0007-self-hosted-sign-in-links.md.
 */
export async function redeemLink(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");

  const identity = token
    ? await redirectOnConfigError(() => redeemSignInLink(token))
    : null;

  redirect(identity ? "/admin" : "/admin/sign-in?error=1");
}

/** Clears the administrator session and returns to the sign-in page. */
export async function signOut(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/sign-in");
}
