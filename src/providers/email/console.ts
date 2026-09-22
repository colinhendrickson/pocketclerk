import { renderReceiptText, type Receipt } from "../renderer/receipt";
import type { EmailSender, SendResult } from "./index";

/**
 * Logs the email instead of sending it. The default when no provider key is
 * configured, so the order flow is fully exercisable with no accounts.
 */
export class ConsoleSender implements EmailSender {
  readonly name = "console";

  async send(to: string, receipt: Receipt): Promise<SendResult> {
    console.log(
      `\n[email] to ${to}\n[email] subject: Your receipt from ${receipt.cartName}\n${renderReceiptText(receipt)}\n`,
    );
    return { ok: true };
  }
}
