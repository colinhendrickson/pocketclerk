import { listStudentsWithTotals } from "@/lib/admin-queries";
import { branding } from "@/lib/branding";
import { getCurrentPayPeriod, listPastPayPeriods } from "@/lib/pay-periods";
import { cartFormatter } from "@/lib/time";

import { requireAdmin } from "../require-admin";
import { AddStudentForm } from "./add-student-form";
import { PastPayPeriods } from "./past-pay-periods";
import { PayPeriodPanel } from "./pay-period-panel";
import { StudentTable } from "./student-table";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * Student roster with this pay period's hours, lifetime totals, and past pay
 * periods. Totals are computed from closed shifts rather than a running
 * counter, so they cannot drift, and starting a pay period deletes nothing.
 */
export default async function AdminStudentsPage() {
  await requireAdmin();

  const period = await getCurrentPayPeriod();
  const [rows, pastPeriods] = await Promise.all([
    listStudentsWithTotals(period.startedAt),
    listPastPayPeriods(),
  ]);
  const activeCount = rows.filter((row) => row.active).length;
  const startedLabel = period.startedAt
    ? cartFormatter({
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(period.startedAt)
    : null;

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

      <PayPeriodPanel currentId={period.id} startedLabel={startedLabel} />

      <StudentTable rows={rows} rewardName={branding.rewardName} />

      <PastPayPeriods periods={pastPeriods} />
    </main>
  );
}
