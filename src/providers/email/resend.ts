import { Resend } from "resend";

import { branding } from "@/lib/branding";

import { renderReceiptText, type Receipt } from "../renderer/receipt";
import { formatFrom } from "./from";
import type { EmailSender, SendResult, TextMessage } from "./index";

/**
 * Sends email through Resend. `from` is on a domain this project can
 * authenticate; `replyTo` reaches the program administrator. The receipt job id
 * is the idempotency key, since delivery is at-least-once.
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
