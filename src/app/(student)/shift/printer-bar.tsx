"use client";

import { Printer, PrinterCheck, TriangleAlert } from "lucide-react";

import { usePrinter } from "../printer-provider";

/**
 * The dashboard's printer controls. Connecting requires a tap because the
 * browser's device chooser needs a user gesture; after that, the printer
 * provider prints queued receipts on every student screen.
 */
export function PrinterBar() {
  const { status, message, printed, connect } = usePrinter();

  if (status === "unsupported") {
    return (
      <div className="alert rounded-box border-base-300 bg-base-100 text-[18px] font-bold">
        <TriangleAlert size={28} aria-hidden="true" />
        {/* Names the fix and who does it, with no link out of the cart. See
            the admin guide "Setting up the receipt printer". */}
        <span>
          Receipts are saved. To print them, a teacher opens the cart in the
          Bluefy app on this iPad.
        </span>
      </div>
    );
  }

  const ready = status === "connected" || status === "printing";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-box border border-base-300 bg-base-100 p-4">
      {ready ? (
        <PrinterCheck size={34} aria-hidden="true" className="text-success" />
      ) : (
        <Printer size={34} aria-hidden="true" className="opacity-75" />
      )}

      <span className="text-[20px] font-bold">
        {status === "printing"
          ? "Printing a receipt…"
          : status === "connected"
            ? `Printer ready${printed > 0 ? ` · ${printed} printed` : ""}`
            : "Printer not connected"}
      </span>

      {ready ? null : (
        <button
          type="button"
          onClick={() => void connect()}
          className="btn btn-outline btn-secondary min-h-[60px] w-full text-[20px] font-extrabold sm:ml-auto sm:w-auto"
        >
          Connect printer
        </button>
      )}

      {message ? (
        <p role="alert" className="w-full text-[18px] font-bold text-warning">
          {message}
        </p>
      ) : null}
    </div>
  );
}
