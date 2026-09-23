import { Resend } from "resend";

import { branding } from "@/lib/branding";

import { renderReceiptText, type Receipt } from "../renderer/receipt";
import { formatFrom } from "./from";
import type { EmailSender, SendResult, TextMessage } from "./index";

/**
 * Sends receipts through Resend.
 *
 * `from` is an address on a domain this project controls, because a school has
 * no mail infrastructure to authenticate against and mail claiming to be from a
 * domain it cannot prove will land in spam. `replyTo` is the program
 * administrator, so a teacher replying to a receipt reaches a person rather
 * than a no-reply mailbox.
 *
 * The job id is passed as the idempotency key. Delivery is at-least-once, so a
 * retried job must not produce a second email.
 */
export class ResendSender implements EmailSender {
  readonly name = "resend";
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(to: string, receipt: Receipt, jobId?: string): Promise<SendResult> {
    const address = process.env.EMAIL_FROM;
    if (!address) return { ok: false, error: "EMAIL_FROM is not configured." };
    const from = formatFrom(address, receipt.cartName);

    try {
      const { error } = await this.client.emails.send(
        {
          from,
          to,
          replyTo: process.env.EMAIL_REPLY_TO ?? address,
          subject: `Your receipt from ${receipt.cartName}`,
          text: renderReceiptText(receipt),
        },
        jobId ? { idempotencyKey: jobId } : undefined,
      );

      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Send failed.",
      };
    }
  }

  async sendText(message: TextMessage): Promise<SendResult> {
    const address = process.env.EMAIL_FROM;
    if (!address) return { ok: false, error: "EMAIL_FROM is not configured." };
    const from = formatFrom(address, branding.cartName);

    try {
      const { error } = await this.client.emails.send({
        from,
        to: message.to,
        replyTo: process.env.EMAIL_REPLY_TO ?? address,
        subject: message.subject,
        text: message.body,
        ...(message.html ? { html: message.html } : {}),
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Send failed.",
      };
    }
  }
}
