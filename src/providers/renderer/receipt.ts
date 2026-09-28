import { cartFormatter } from "@/lib/time";
import { formatUSD } from "@/lib/money";

import { toPrintableAscii } from "./ascii";

/**
 * Printer-independent receipt document. Providers turn it into bytes for their
 * hardware, so layout and delivery change independently.
 */

export interface ReceiptLine {
  name: string;
  qty: number;
  /** Price for the whole line, in cents. */
  amountCents: number;
  /** Rendered indented under its parent line. */
  isAddon?: boolean;
}

export interface Receipt {
  programName: string;
  cartName: string;
  teacherName: string;
  room: string | null;
  studentName: string;
  placedAt: Date;
  lines: ReceiptLine[];
  totalCents: number;
  receivedCents: number;
  changeCents: number;
}

/** Characters across a 58mm roll at the default font: 32. */
export const RECEIPT_WIDTH = 32;

function padRow(left: string, right: string, width = RECEIPT_WIDTH): string {
  const gap = Math.max(1, width - left.length - right.length);
  if (left.length + right.length + 1 > width) {
    // Truncate the label rather than wrap; the amount must never be cut.
    const room = Math.max(0, width - right.length - 1);
    return `${left.slice(0, room)} ${right}`;
  }
  return `${left}${" ".repeat(gap)}${right}`;
}

function center(text: string, width = RECEIPT_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return `${" ".repeat(pad)}${text}`;
}

/**
 * Renders the receipt as plain monospaced text for the plain-text email and
 * the console.
 */
export function renderReceiptText(receipt: Receipt): string {
  return layoutReceipt(receipt, (text) => text);
}

/**
 * The same layout reduced to printable ASCII for a thermal printer. Fields
 * are converted before padding so columns line up on paper.
 */
export function renderPrintableReceiptText(receipt: Receipt): string {
  return layoutReceipt(receipt, toPrintableAscii);
}

function layoutReceipt(receipt: Receipt, clean: (text: string) => string): string {
  const row = (left: string, right: string) => padRow(clean(left), clean(right));
  const title = (text: string) => center(clean(text));

  const date = cartFormatter({
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(receipt.placedAt);
  const time = cartFormatter({
    hour: "numeric",
    minute: "2-digit",
  }).format(receipt.placedAt);

  const rule = "-".repeat(RECEIPT_WIDTH);
  const out: string[] = [
    title(receipt.programName.toUpperCase()),
    title(receipt.cartName.toUpperCase()),
    "",
    rule,
    row("Teacher", receipt.teacherName),
  ];

  if (receipt.room) out.push(row("Room", receipt.room));
  out.push(
    row("Date", date),
    row("Time", time),
    row("Served by", receipt.studentName),
    rule,
    "",
  );

  for (const line of receipt.lines) {
    const label = line.isAddon
      ? `  ${line.name}`
      : `${line.qty} x ${line.name}`;
    out.push(row(label, formatUSD(line.amountCents)));
  }

  out.push(
    "",
    rule,
    row("TOTAL", formatUSD(receipt.totalCents)),
    row("Paid", formatUSD(receipt.receivedCents)),
    row("Change", formatUSD(receipt.changeCents)),
    rule,
    "",
    title("Thank you!"),
    "",
  );

  return out.join("\n");
}
