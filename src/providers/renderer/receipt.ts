import { formatUSD } from "@/lib/money";

/**
 * The receipt, as data.
 *
 * Rendering is deliberately separated from delivery. This module turns an order
 * into a printer-independent document, and the printer providers turn that
 * document into bytes for whatever hardware is attached. Swapping the printer
 * does not touch this file, and changing the receipt layout does not touch the
 * printers.
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

function centre(text: string, width = RECEIPT_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return `${" ".repeat(pad)}${text}`;
}

/**
 * Renders the receipt as plain monospaced text.
 *
 * Plain text is the lowest common denominator every thermal printer
 * understands, and it is also what the console printer logs in development, so
 * what a developer sees is what a teacher gets.
 */
export function renderReceiptText(receipt: Receipt): string {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(receipt.placedAt);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(receipt.placedAt);

  const rule = "-".repeat(RECEIPT_WIDTH);
  const out: string[] = [
    centre(receipt.programName.toUpperCase()),
    centre(receipt.cartName.toUpperCase()),
    "",
    rule,
    padRow("Teacher", receipt.teacherName),
  ];

  if (receipt.room) out.push(padRow("Room", receipt.room));
  out.push(
    padRow("Date", date),
    padRow("Time", time),
    padRow("Served by", receipt.studentName),
    rule,
    "",
  );

  for (const line of receipt.lines) {
    const label = line.isAddon
      ? `  ${line.name}`
      : `${line.qty} x ${line.name}`;
    out.push(padRow(label, formatUSD(line.amountCents)));
  }

  out.push(
    "",
    rule,
    padRow("TOTAL", formatUSD(receipt.totalCents)),
    padRow("Paid", formatUSD(receipt.receivedCents)),
    padRow("Change", formatUSD(receipt.changeCents)),
    rule,
    "",
    centre("Thank you!"),
    "",
  );

  return out.join("\n");
}
