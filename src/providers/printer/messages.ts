/**
 * Student-facing wording for printer problems. Browser errors are technical
 * ("GATT Server is disconnected"), so they are translated here and never shown.
 */

/** A setup problem the app itself detected; its message is already written for staff. */
export class PrinterSetupError extends Error {
  override name = "PrinterSetupError";
}

/** Message for a failed Connect printer, or null when there is nothing to report. */
export function connectErrorMessage(error: unknown): string | null {
  if (error instanceof PrinterSetupError) return error.message;
  const name = error instanceof Error ? error.name : "";
  // The chooser was closed without picking a printer.
  if (name === "NotFoundError" || name === "AbortError") return null;
  if (name === "SecurityError" || name === "NotAllowedError") {
    return "Bluetooth is turned off or not allowed. Turn on Bluetooth in the iPad's Settings, then try again.";
  }
  return "Could not connect to the printer. Check that it is on and nearby, then press Connect printer.";
}

/** Message for a receipt that did not print. The raw error is kept on the job for staff. */
export function printErrorMessage(): string {
  return "A receipt did not print. Check that the printer is on and has paper.";
}
