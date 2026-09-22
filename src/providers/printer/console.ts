import { renderReceiptText, type Receipt } from "../renderer/receipt";
import type { PrintResult, ReceiptPrinter } from "./index";

/**
 * Prints to the console.
 *
 * The fallback when no hardware is attached, which is the normal state in
 * development and in CI. It exists so the whole order flow can be exercised
 * with zero configuration and zero secrets, and so a contributor can see
 * exactly what a teacher would receive.
 */
export class ConsolePrinter implements ReceiptPrinter {
  readonly name = "console";
  readonly runsOn = "server" as const;

  async isReady(): Promise<boolean> {
    return true;
  }

  async print(receipt: Receipt): Promise<PrintResult> {
    console.log(`\n${renderReceiptText(receipt)}\n`);
    return { ok: true };
  }
}
