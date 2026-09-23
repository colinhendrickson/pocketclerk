import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import Link from "next/link";

import {
  addDays,
  cartFormatter,
  parseLocalDate,
  startOfLocalDay,
  today,
} from "@/lib/time";
import { db } from "@/db";
import {
  orderItemAddons,
  orderItems,
  orders,
  persons,
  shifts,
  students,
  teacherProfiles,
} from "@/db/schema";
import { formatUSD } from "@/lib/money";

import { requireAdmin } from "../require-admin";

export const dynamic = "force-dynamic";

/**
 * Every sale, one day at a time.
 *
 * A day is the unit the administrator thinks in, because the cart runs one
 * shift a day and the question is almost always "what happened on Tuesday".
 * Paging by day rather than by row count keeps that question answerable without
 * a filter builder.
 *
 * Line items are read from the snapshot columns, so this page shows what was
 * actually charged rather than what the menu says today.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  // A day is a calendar date at the cart, bounded by its local midnights. Not
  // UTC midnight, which is 8 PM at the cart, and not midnight plus 24 hours,
  // which is wrong on the two days a year that are 23 and 25 hours long.
  const date = parseLocalDate(params.date) ?? today();
  const day = startOfLocalDay(date);
  const next = startOfLocalDay(addDays(date, 1));

  const rows = await db
    .select({
      id: orders.id,
      totalCents: orders.totalCents,
      receivedCents: orders.receivedCents,
      changeCents: orders.changeCents,
      createdAt: orders.createdAt,
      teacherName: persons.name,
      room: teacherProfiles.room,
      studentName: students.displayName,
      items: sql<string>`(
        SELECT string_agg(oi.qty || ' x ' || oi.name_snapshot, ', ' ORDER BY oi.id)
        FROM ${orderItems} oi WHERE oi.order_id = ${orders.id}
      )`,
      extras: sql<string>`(
        SELECT string_agg(DISTINCT oa.name_snapshot, ', ')
        FROM ${orderItemAddons} oa
        JOIN ${orderItems} oi2 ON oi2.id = oa.order_item_id
        WHERE oi2.order_id = ${orders.id}
      )`,
    })
    .from(orders)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .innerJoin(shifts, eq(shifts.id, orders.shiftId))
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(gte(orders.createdAt, day), lt(orders.createdAt, next)))
    .orderBy(desc(orders.createdAt));

  const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
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
        <nav className="flex items-center gap-2">
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

      <div className="stats border border-base-300 bg-base-100">
        <div className="stat">
          <span className="stat-title">Orders</span>
          <span className="stat-value tabular">{rows.length}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Sales</span>
          <span className="stat-value tabular">{formatUSD(totalCents)}</span>
        </div>
      </div>

      <div
        role="region"
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
              <th className="text-right">Paid</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="opacity-70">
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
                <td className="text-right tabular">
                  {row.receivedCents === null ? "" : formatUSD(row.receivedCents)}
                </td>
                <td className="text-right tabular">
                  {row.changeCents === null ? "" : formatUSD(row.changeCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

