import { cartFormatter } from "@/lib/time";
import { listTeachersWithTotals } from "@/lib/admin-queries";

import { requireAdmin } from "../require-admin";
import { AddTeacherForm } from "./add-teacher-form";
import { TeacherTable, type TeacherView } from "./teacher-table";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * The teacher list: the cart's customers.
 *
 * Teachers come onto the list two ways: from the cart, mid-order, by the student
 * standing in the classroom, and from here, which is how the list is filled in
 * before the cart's first day. Both go through the same function and the same
 * rules. This page is also for correcting what was typed, keeping notes
 * current, and seeing who buys what.
 */
export default async function AdminTeachersPage() {
  await requireAdmin();

  const rows = await listTeachersWithTotals();

  /**
   * Dates are formatted here rather than in the table.
   *
   * The table is a client component, so a `Date` rendered inside it would be
   * formatted once on the server and again in the browser, which React flags
   * as a hydration mismatch if the two disagree. Formatting once here avoids
   * the double render, and `cartFormatter` decides which clock: the cart's,
   * not the server's UTC, which is what "once on the server" used to mean.
   */
  const formatter = cartFormatter({
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
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Teachers</h1>
        <p className="opacity-70">
          <span className="tabular">{activeCount}</span> active of{" "}
          <span className="tabular">{views.length}</span>. Open a row to edit
          details, keep notes and see what they have bought.
        </p>
      </header>

      <HelpPanel route="/admin/teachers" />

      <AddTeacherForm />

      <TeacherTable rows={views} />
    </main>
  );
}
