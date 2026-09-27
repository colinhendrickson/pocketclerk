import { renderReceiptText, type Receipt } from "../renderer/receipt";
import type { PrintResult, ReceiptPrinter } from "./index";

/** Prints receipts to the console; the fallback when no printer is attached. */
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
