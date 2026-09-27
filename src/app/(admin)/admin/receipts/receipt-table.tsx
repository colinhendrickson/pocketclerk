"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { formatUSD } from "@/lib/money";

import { dismissReceiptJob, retryAllFailed, retryReceiptJob } from "./actions";

export interface ReceiptJobRow {
  id: string;
  channel: "print" | "email";
  status: "queued" | "processing" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  orderTotalCents: number;
  teacherName: string;
  studentName: string;
}

export interface ReceiptTableProps {
  rows: ReceiptJobRow[];
  failedCount: number;
}

/**
 * Receipt job monitor: the visible side of the async delivery queue, where
 * failed receipts can be retried or dismissed.
 */
export function ReceiptTable({ rows, failedCount }: ReceiptTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const badge: Record<ReceiptJobRow["status"], string> = {
    queued: "badge-warning",
    processing: "badge-info",
    sent: "badge-success",
    failed: "badge-error",
  };

  return (
    <div className="flex flex-col gap-4">
      {failedCount > 0 ? (
        <div className="alert alert-warning rounded-box">
          <span>
            {failedCount} {failedCount === 1 ? "receipt" : "receipts"} could not
            be delivered. Fix the cause, then retry.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await retryAllFailed();
                router.refresh();
              })
            }
            className="btn btn-sm"
          >
            Retry all
          </button>
        </div>
      ) : null}

      <div
        role="region"
        data-tour="receipts-table"
        aria-label="Receipts"
        tabIndex={0}
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
        <table className="table table-sm">
          <thead>
            <tr>
              <th>When</th>
              <th>Order</th>
              <th>Channel</th>
              <th>Status</th>
              <th className="text-right">Tries</th>
              <th>Problem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="opacity-70">
                  No receipts yet.
                </td>
              </tr>
            ) : null}

            {rows.map((row) => (
              <tr key={row.id}>
                <td className="tabular whitespace-nowrap">{row.createdAt}</td>
                <td>
                  {row.teacherName}
                  <span className="opacity-75">
                    {" · "}
                    {formatUSD(row.orderTotalCents)}
                    {" · by "}
                    {row.studentName}
                  </span>
                </td>
                <td>{row.channel}</td>
                <td>
                  <span className={`badge ${badge[row.status]}`}>{row.status}</span>
                </td>
                <td className="text-right tabular">{row.attempts}</td>
                <td className="max-w-xs truncate" title={row.lastError ?? ""}>
                  {row.lastError ?? ""}
                </td>
                <td className="whitespace-nowrap text-right">
                  {row.status === "failed" ? (
                    <span className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await retryReceiptJob(row.id);
                            router.refresh();
                          })
                        }
                        className="btn btn-xs btn-outline"
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        Retry
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await dismissReceiptJob(row.id);
                            router.refresh();
                          })
                        }
                        className="btn btn-xs btn-ghost"
                        title="Give up on this receipt. The order itself is unaffected."
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Dismiss
                      </button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
