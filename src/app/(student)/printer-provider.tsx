"use client";

import { TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { connectErrorMessage, printErrorMessage } from "@/providers/printer/messages";
import { WebBluetoothPrinter } from "@/providers/printer/web-bluetooth";

import { claimPrintJobs, reportPrintResult } from "./print-actions";

/** `lost` means the printer was connected and has since dropped. */
export type PrinterStatus =
  | "unsupported"
  | "disconnected"
  | "connected"
  | "printing"
  | "lost"
  | "error";

interface PrinterState {
  status: PrinterStatus;
  message: string | null;
  printed: number;
  connect: () => Promise<void>;
}

const PrinterContext = createContext<PrinterState | null>(null);

/** How often the tablet looks for receipts waiting to be printed. */
const POLL_MS = 8000;

/**
 * Owns the Bluetooth printer and drains the print queue. It sits in the
 * student layout so the connection and polling survive navigation between
 * screens; students spend most of a shift on the order screen, not the one
 * with the connect button. Without a printer, jobs wait in the queue and sales
 * are unaffected.
 */
export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const printerRef = useRef<WebBluetoothPrinter | null>(null);
  const drainingRef = useRef(false);
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [message, setMessage] = useState<string | null>(null);
  const [printed, setPrinted] = useState(0);

  useEffect(() => {
    if (!WebBluetoothPrinter.isSupported()) setStatus("unsupported");
  }, []);

  const drain = useCallback(async () => {
    const printer = printerRef.current;
    if (!printer || drainingRef.current) return;

    drainingRef.current = true;
    try {
      if (!(await printer.isReady()) && !(await printer.reconnect())) {
        setStatus("lost");
        return;
      }
      setStatus("connected");

      const jobs = await claimPrintJobs();
      if (jobs.length === 0) return;

      setStatus("printing");
      for (const job of jobs) {
        const result = await printer.print(job.receipt);
        await reportPrintResult(job.jobId, result.ok, result.error);
        if (result.ok) {
          setPrinted((n) => n + 1);
          setMessage(null);
        } else {
          setMessage(printErrorMessage());
        }
      }
      setStatus("connected");
    } catch {
      // Offline or the server is unreachable. Claimed jobs return to the queue
      // once stale, so the next poll simply tries again.
      setStatus((current) => (current === "printing" ? "connected" : current));
    } finally {
      drainingRef.current = false;
    }
  }, []);

  const polling = status === "connected" || status === "printing" || status === "lost";
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => void drain(), POLL_MS);
    return () => clearInterval(id);
  }, [polling, drain]);

  const connect = useCallback(async () => {
    setMessage(null);
    const printer = printerRef.current ?? new WebBluetoothPrinter();
    printerRef.current = printer;
    try {
      await printer.connect();
      setStatus("connected");
      void drain();
    } catch (error) {
      const message = connectErrorMessage(error);
      // Closing the chooser without picking a printer is not an error.
      setStatus(message ? "error" : "disconnected");
      setMessage(message);
    }
  }, [drain]);

  return (
    <PrinterContext value={{ status, message, printed, connect }}>
      <PrinterNotice />
      {children}
    </PrinterContext>
  );
}

export function usePrinter(): PrinterState {
  const state = useContext(PrinterContext);
  if (!state) throw new Error("usePrinter must be used inside PrinterProvider.");
  return state;
}

/**
 * A one-line warning on shift screens other than the dashboard, which has the
 * full printer bar. It has no button, so it never competes with the screen's
 * primary action; reconnecting happens on the dashboard.
 */
function PrinterNotice() {
  const pathname = usePathname();
  const { status, message } = usePrinter();

  if (!pathname.startsWith("/shift/")) return null;

  const text =
    status === "lost"
      ? "Printer not connected. Receipts are saved. Check that the printer is on."
      : message && (status === "connected" || status === "printing")
        ? message
        : null;
  if (!text) return null;

  return (
    <div
      role="status"
      className="alert alert-warning rounded-none text-[18px] font-bold"
    >
      <TriangleAlert size={28} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
