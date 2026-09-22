"use server";

import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import { clearAdminSession, requestSignInLink } from "@/lib/admin-auth";
import { isConfigurationError } from "@/lib/config";
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
    await sender.sendText({
      to: result.identity.email,
      subject: `Sign in to ${branding.cartName}`,
      body: [
        `Hello ${result.identity.name},`,
        "",
        "Use this link to sign in. It works once and expires in 15 minutes.",
        "",
        link,
        "",
        "If you did not ask for this, you can ignore it.",
      ].join("\n"),
    });
  }

  redirect("/admin/sign-in?sent=1");
}


export async function signOut(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/sign-in");
}
