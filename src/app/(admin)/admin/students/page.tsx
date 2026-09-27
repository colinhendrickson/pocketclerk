import { listStudentsWithTotals } from "@/lib/admin-queries";
import { branding } from "@/lib/branding";

import { requireAdmin } from "../require-admin";
import { AddStudentForm } from "./add-student-form";
import { StudentTable } from "./student-table";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * Student roster with hours and reward totals. Totals are computed from closed
 * shifts rather than a running counter, so they cannot drift.
 */
export default async function AdminStudentsPage() {
  await requireAdmin();

  const rows = await listStudentsWithTotals();
  const activeCount = rows.filter((row) => row.active).length;

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Students</h1>
        <p className="opacity-70">
          <span className="tabular">{activeCount}</span> active of{" "}
          <span className="tabular">{rows.length}</span> on the roster.
        </p>
      </header>

      <HelpPanel route="/admin/students" />

      <AddStudentForm heading="Add a student" />

      <StudentTable rows={rows} rewardName={branding.rewardName} />
    </main>
  );
}
