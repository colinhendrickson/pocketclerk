"use client";

import { Printer, PrinterCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { WebBluetoothPrinter } from "@/providers/printer/web-bluetooth";

import { claimPrintJobs, reportPrintResult } from "../print-actions";

type Status = "unsupported" | "disconnected" | "connected" | "printing" | "error";

/** How often the tablet looks for receipts waiting to be printed. */
const POLL_MS = 8000;

/**
 * Connects the printer and drains the print queue.
 *
 * Connecting has to be a deliberate tap because the browser only opens its
 * device chooser from a user gesture, so this is one action at the start of a
 * shift rather than something that can happen on its own. The rest is
 * automatic: once connected, queued receipts print as they appear.
 *
 * If no printer is connected the receipts simply wait. A sale is never blocked
 * on this, which is the entire point of the queue sitting between them.
 */
export function PrinterBar() {
  const printerRef = useRef<WebBluetoothPrinter | null>(null);
  const drainingRef = useRef(false);
  const [status, setStatus] = useState<Status>("disconnected");
  const [message, setMessage] = useState<string | null>(null);
  const [printed, setPrinted] = useState(0);

  useEffect(() => {
    if (!WebBluetoothPrinter.isSupported()) setStatus("unsupported");
  }, []);

  const drain = useCallback(async () => {
    const printer = printerRef.current;
    if (!printer || drainingRef.current) return;
    if (!(await printer.isReady())) {
      setStatus("disconnected");
      return;
    }

    drainingRef.current = true;
    try {
      const jobs = await claimPrintJobs();
      if (jobs.length === 0) return;

      setStatus("printing");
      for (const job of jobs) {
        const result = await printer.print(job.receipt);
        await reportPrintResult(job.jobId, result.ok, result.error);
        if (result.ok) setPrinted((n) => n + 1);
        else setMessage(result.error ?? "A receipt did not print.");
      }
      setStatus("connected");
    } finally {
      drainingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (status !== "connected" && status !== "printing") return;
    const id = setInterval(() => void drain(), POLL_MS);
    return () => clearInterval(id);
  }, [status, drain]);

  async function connect() {
    setMessage(null);
    const printer = printerRef.current ?? new WebBluetoothPrinter();
    printerRef.current = printer;
    try {
      await printer.connect();
      setStatus("connected");
      void drain();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not connect.");
    }
  }

  if (status === "unsupported") {
    return (
      <div className="alert rounded-box border-base-300 bg-base-100 text-[18px] font-bold">
        <TriangleAlert size={28} aria-hidden="true" />
        <span>
          Receipts are saved and will print once this device is opened in a
          browser that can reach the printer.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-box border border-base-300 bg-base-100 p-4">
      {status === "connected" || status === "printing" ? (
        <PrinterCheck size={34} aria-hidden="true" className="text-success" />
      ) : (
        <Printer size={34} aria-hidden="true" className="opacity-60" />
      )}

      <span className="text-[20px] font-bold">
        {status === "printing"
          ? "Printing a receipt…"
          : status === "connected"
            ? `Printer ready${printed > 0 ? ` · ${printed} printed` : ""}`
            : "Printer not connected"}
      </span>

      {status === "connected" || status === "printing" ? null : (
        <button
          type="button"
          onClick={connect}
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
