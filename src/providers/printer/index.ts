import type { Receipt } from "../renderer/receipt";

/**
 * Receipt printer interface. `runsOn` tells the job dispatcher where a provider
 * can execute: a Bluetooth printer is reachable only from the tablet's browser,
 * a network printer only from the server.
 * See docs/adr/0013-providers-for-every-effect.md.
 */
export interface PrintResult {
  ok: boolean;
  error?: string;
}

export interface ReceiptPrinter {
  readonly name: string;
  readonly runsOn: "client" | "server";
  /** True when connected and ready to accept a job. */
  isReady(): Promise<boolean>;
  print(receipt: Receipt): Promise<PrintResult>;
}

export { ConsolePrinter } from "./console";
export { WebBluetoothPrinter } from "./web-bluetooth";
