import type { Receipt } from "../renderer/receipt";

/**
 * The email seam.
 *
 * Same shape as the printer: business logic depends on this interface, and the
 * factory picks an implementation from the environment. Without a Resend key
 * the console sender is used, so development and CI run with no secrets and a
 * contributor can watch the whole order flow work on a fresh clone.
 */
export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface TextMessage {
  to: string;
  subject: string;
  /** Always sent. The fallback for clients that do not render HTML. */
  body: string;
  /** Optional rich version. Providers that cannot send HTML ignore it. */
  html?: string;
}

export interface EmailSender {
  readonly name: string;
  /** A rendered receipt, the common case. */
  send(to: string, receipt: Receipt): Promise<SendResult>;
  /**
   * Any other message, such as an administrator sign-in link. Kept on the same
   * interface so a deployment configures one email provider, not two.
   */
  sendText(message: TextMessage): Promise<SendResult>;
}

import { ConsoleSender } from "./console";
import { ResendSender } from "./resend";

export { ConsoleSender, ResendSender };

/**
 * Chooses a sender from the environment.
 *
 * The absence of a key is a supported configuration, not a failure. A missing
 * credential should mean "log it" in development, never a crash on the first
 * completed order.
 */
export function getEmailSender(): EmailSender {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendSender(key) : new ConsoleSender();
}
