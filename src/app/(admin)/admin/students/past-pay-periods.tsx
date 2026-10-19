import type { PastPayPeriod } from "@/lib/pay-periods";
import { formatHours } from "@/lib/money";
import { cartFormatter } from "@/lib/time";

/**
 * Finished pay periods (4.23), newest first, one collapsible table each. Only
 * students who worked in a period are listed in it.
 */
export function PastPayPeriods({ periods }: { periods: PastPayPeriod[] }) {
  if (periods.length === 0) return null;

  const date = cartFormatter({ month: "short", day: "numeric", year: "numeric" });

  return (
    <section data-tour="past-pay-periods" className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Past pay periods</h2>
      {periods.map((period) => {
        const totalHundredths = period.students.reduce(
          (sum, student) => sum + student.hoursHundredths,
          0,
        );
        return (
          <details
            key={period.endedAt.toISOString()}
            className="rounded-box border border-base-300 bg-base-100"
          >
            <summary className="cursor-pointer p-4 font-bold">
              {date.format(period.startedAt)} to {date.format(period.endedAt)}
              <span className="ml-2 font-normal opacity-70">
                <span className="tabular">{formatHours(totalHundredths)}</span> hours in all
              </span>
            </summary>
            <div className="overflow-x-auto px-4 pb-4">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Shifts</th>
                    <th className="text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {period.students.map((student) => (
                    <tr key={student.studentId}>
                      <td className="font-bold">{student.displayName}</td>
                      <td className="text-right tabular">{student.shiftCount}</td>
                      <td className="text-right tabular">
                        {formatHours(student.hoursHundredths)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </section>
  );
}
