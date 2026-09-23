import { listStudentsWithTotals } from "@/lib/admin-queries";
import { branding } from "@/lib/branding";

import { requireAdmin } from "../require-admin";
import { AddStudentForm } from "./add-student-form";
import { StudentTable } from "./student-table";

export const dynamic = "force-dynamic";

/**
 * The student roster.
 *
 * Hours and reward tickets are here rather than on a separate report because
 * they are the reason the administrator opens this page at all: the program
 * exists to record what each student worked, and the roster is where that lives.
 *
 * Totals come from the closed shifts themselves, not from a running counter, so
 * there is no second number that can drift away from the first.
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

      <AddStudentForm heading="Add a student" />

      <StudentTable rows={rows} rewardName={branding.rewardName} />
    </main>
  );
}
