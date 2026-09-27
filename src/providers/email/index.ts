import type { Receipt } from "../renderer/receipt";

/**
 * Email provider interface. The factory picks an implementation from the
 * environment, falling back to the console sender so development and CI need
 * no secrets. See docs/adr/0013-providers-for-every-effect.md.
 */
export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface TextMessage {
  to: string;
  subject: string;
  /** Always sent; the fallback for clients that do not render HTML. */
  body: string;
  /** Optional; providers that cannot send HTML ignore it. */
  html?: string;
}

export interface EmailSender {
  readonly name: string;
  /**
   * Sends a receipt. `idempotencyKey` is the receipt job id: delivery is
   * at-least-once, so a retry after a failed `markSent` must not send twice.
   */
  send(to: string, receipt: Receipt, idempotencyKey?: string): Promise<SendResult>;
  /** Any other message, such as an admin sign-in link. */
  sendText(message: TextMessage): Promise<SendResult>;
}

import { ConsoleSender } from "./console";
import { ResendSender } from "./resend";
import { siteMode } from "@/lib/site-mode";

export { ConsoleSender, ResendSender };

/**
 * Chooses a sender from the environment; no key means the console sender. The
 * demo always logs, so it cannot be used to mail arbitrary addresses.
 */
export function getEmailSender(): EmailSender {
  if (siteMode() === "demo") return new ConsoleSender();
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendSender(key) : new ConsoleSender();
}
