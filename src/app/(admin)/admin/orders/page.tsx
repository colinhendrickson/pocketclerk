import Link from "next/link";

import {
  addDays,
  cartFormatter,
  parseLocalDate,
  startOfLocalDay,
  today,
} from "@/lib/time";
import { getSalesBetween, listOrdersBetween, type AdminOrderRow } from "@/lib/admin-queries";
import { formatUSD } from "@/lib/money";

import { requireAdmin } from "../require-admin";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/** Orders, paged by day, with cash and staff card sales totaled apart. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  // Bounded by local midnights: not UTC, and not +24h (wrong on DST days).
  const date = parseLocalDate(params.date) ?? today();
  const day = startOfLocalDay(date);
  const next = startOfLocalDay(addDays(date, 1));

  const [rows, sales] = await Promise.all([
    listOrdersBetween(day, next),
    getSalesBetween(day, next),
  ]);
  const time = cartFormatter({
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Orders</h1>
          <p className="opacity-70">
            {cartFormatter({
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(day)}
          </p>
        </div>
        <nav aria-label="Choose a day" data-tour="day-nav" className="flex items-center gap-2">
          <Link
            href={`/admin/orders?date=${addDays(date, -1)}`}
            className="btn btn-sm btn-outline"
          >
            Previous day
          </Link>
          <Link href="/admin/orders" className="btn btn-sm btn-outline">
            Today
          </Link>
          <Link
            href={`/admin/orders?date=${addDays(date, 1)}`}
            className="btn btn-sm btn-outline"
          >
            Next day
          </Link>
        </nav>
      </div>

      <HelpPanel route="/admin/orders" />

      <div className="stats stats-vertical border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat">
          <span className="stat-title">Orders</span>
          <span className="stat-value tabular">{sales.orderCount}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Sales</span>
          <span className="stat-value tabular">{formatUSD(sales.totalCents)}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Cash</span>
          <span className="stat-value tabular">{formatUSD(sales.cashCents)}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Staff card</span>
          <span className="stat-value tabular">{formatUSD(sales.cardCents)}</span>
        </div>
      </div>

      <div
        role="region"
        data-tour="orders-table"
        aria-label="Orders"
        tabIndex={0}
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>Teacher</th>
              <th>Served by</th>
              <th>Items</th>
              <th className="text-right">Total</th>
              <th>Paid by</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="opacity-70">
                  No orders on this day.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="tabular whitespace-nowrap">
                  {time.format(row.createdAt)}
                </td>
                <td className="whitespace-nowrap">
                  {row.teacherName}
                  {row.room ? (
                    <span className="opacity-75"> · Room {row.room}</span>
                  ) : null}
                </td>
                <td>{row.studentName}</td>
                <td>
                  {row.items}
                  {row.extras ? (
                    <span className="opacity-75"> ({row.extras})</span>
                  ) : null}
                </td>
                <td className="text-right tabular">{formatUSD(row.totalCents)}</td>
                <td className="whitespace-nowrap">{paymentSummary(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/** "Cash, $5.00 received, $1.50 change" or "Staff card". */
function paymentSummary(row: AdminOrderRow): string {
  if (row.paymentMethod === "card") return "Staff card";
  if (row.receivedCents === null || row.changeCents === null) return "Cash";
  return `Cash, ${formatUSD(row.receivedCents)} received, ${formatUSD(row.changeCents)} change`;
}
