import type { Receipt } from "../renderer/receipt";

/**
 * The printer seam.
 *
 * Business logic depends on this interface and never on a vendor. The V1
 * implementation drives a cheap Bluetooth thermal printer from the tablet's
 * browser; a network printer that polls the server for work would be a second
 * implementation and zero changed call sites.
 *
 * `runsOn` exists because that difference is real and has to be visible.
 * A Bluetooth printer is attached to the tablet and unreachable from a server,
 * so its jobs are claimed in the browser. A network printer is the reverse.
 * Code that dispatches receipt jobs reads this field to know where a given
 * provider can run.
 */
export interface PrintResult {
  ok: boolean;
  error?: string;
}

export interface ReceiptPrinter {
  readonly name: string;
  /** Where this provider is able to execute. */
  readonly runsOn: "client" | "server";
  /** True when the printer is connected and ready to accept a job. */
  isReady(): Promise<boolean>;
  print(receipt: Receipt): Promise<PrintResult>;
}

export { ConsolePrinter } from "./console";
export { WebBluetoothPrinter } from "./web-bluetooth";
