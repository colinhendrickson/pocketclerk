import { cartFormatter } from "@/lib/time";
import { listTeachersWithTotals } from "@/lib/admin-queries";

import { requireAdmin } from "../require-admin";
import { AddTeacherForm } from "./add-teacher-form";
import { TeacherTable, type TeacherView } from "./teacher-table";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * Teacher list (the cart's customers). Teachers are added here or from the cart
 * mid-order, both through `insertTeacher`.
 */
export default async function AdminTeachersPage() {
  await requireAdmin();

  const rows = await listTeachersWithTotals();

  // Format dates on the server, in the cart's time zone, so the client table
  // cannot hit a hydration mismatch.
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
