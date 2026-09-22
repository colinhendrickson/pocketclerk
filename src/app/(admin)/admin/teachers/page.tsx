import { listTeachersWithTotals } from "@/lib/admin-queries";

import { requireAdmin } from "../require-admin";
import { TeacherTable, type TeacherView } from "./teacher-table";

export const dynamic = "force-dynamic";

/**
 * The teacher list: the cart's customers.
 *
 * There is no "add a teacher" form here on purpose. Teachers are added from the
 * cart, mid-order, by the student standing in the classroom — that is where the
 * name and room number are actually known. This page is for correcting what
 * they typed, keeping notes current, and seeing who buys what.
 */
export default async function AdminTeachersPage() {
  await requireAdmin();

  const rows = await listTeachersWithTotals();

  /**
   * Dates are formatted here rather than in the table.
   *
   * The table is a client component, so a `Date` rendered inside it would be
   * formatted once on the server and again in the browser, in two different
   * time zones, which React flags as a hydration mismatch. Doing it once on the
   * server settles which clock the page speaks in.
   */
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const views: TeacherView[] = rows.map((row) => ({
    ...row,
    recentOrders: row.recentOrders.map((order) => ({
      id: order.id,
      when: formatter.format(order.createdAt),
      totalCents: order.totalCents,
    })),
  }));

  const activeCount = views.filter((row) => row.active).length;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Teachers</h1>
        <p className="opacity-70">
          <span className="tabular">{activeCount}</span> active of{" "}
          <span className="tabular">{views.length}</span>. Open a row to edit
          details, keep notes and see what they have bought.
        </p>
      </header>

      <TeacherTable rows={views} />
    </main>
  );
}
