import { desc, eq, sql } from "drizzle-orm";

import { cartFormatter } from "@/lib/time";
import { db } from "@/db";
import {
  orders,
  persons,
  receiptJobs,
  shifts,
  students,
  teacherProfiles,
} from "@/db/schema";

import { requireAdmin } from "../require-admin";
import { ReceiptTable, type ReceiptJobRow } from "./receipt-table";

export const dynamic = "force-dynamic";

/**
 * Receipt delivery status.
 *
 * Failed jobs sort first regardless of age, because they are the only rows that
 * require anyone to act. Everything else is here to answer "did that one go
 * out?" and is ordered newest first.
 */
export default async function AdminReceiptsPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: receiptJobs.id,
      channel: receiptJobs.channel,
      status: receiptJobs.status,
      attempts: receiptJobs.attempts,
      lastError: receiptJobs.lastError,
      createdAt: receiptJobs.createdAt,
      orderTotalCents: orders.totalCents,
      teacherName: persons.name,
      studentName: students.displayName,
    })
    .from(receiptJobs)
    .innerJoin(orders, eq(orders.id, receiptJobs.orderId))
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .innerJoin(shifts, eq(shifts.id, orders.shiftId))
    .innerJoin(students, eq(students.id, shifts.studentId))
    .orderBy(
      sql`CASE WHEN ${receiptJobs.status} = 'failed' THEN 0 ELSE 1 END`,
      desc(receiptJobs.createdAt),
    )
    .limit(200);

  const when = cartFormatter({
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const table: ReceiptJobRow[] = rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: when.format(row.createdAt),
    orderTotalCents: row.orderTotalCents,
    teacherName: row.teacherName,
    studentName: row.studentName,
  }));

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-extrabold">Receipts</h1>
        <p className="opacity-70">
          Orders are saved the moment they are taken. Delivering the receipt
          happens afterwards, so a printer that was switched off or an address
          that was mistyped shows up here rather than costing a sale.
        </p>
      </div>

      <ReceiptTable
        rows={table}
        failedCount={table.filter((r) => r.status === "failed").length}
      />
    </main>
  );
}
