import type { MoneyLedger as Ledger } from "@/lib/expenses";
import { formatUSD, netCents } from "@/lib/money";
import { cartFormatter } from "@/lib/time";

/** "2026-09" as "September 2026". */
function monthLabel(month: string): string {
  const [year, monthOfYear] = month.split("-").map(Number);
  // Mid-month noon UTC is the same calendar month in every zone.
  return cartFormatter({ month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, monthOfYear - 1, 15, 12)),
  );
}

/**
 * Sold, spent and net for all time, then the same by month with a running
 * total. Net is signed at the display edge only; the ledger stores nothing
 * derived.
 */
export function MoneyLedger({ ledger }: { ledger: Ledger }) {
  const net = netCents(ledger.soldCents, ledger.spentCents);
  const nothingYet = ledger.months.length === 0;

  return (
    <section aria-labelledby="money-heading" data-tour="money" className="flex flex-col gap-3">
      <h2 id="money-heading" className="text-xl font-extrabold">
        Is the cart paying for itself?
      </h2>

      <div className="stats stats-vertical border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat">
          <span className="stat-title">Sold</span>
          <span className="stat-value tabular">{formatUSD(ledger.soldCents)}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Spent</span>
          <span className="stat-value tabular">{formatUSD(ledger.spentCents)}</span>
        </div>
        <div className="stat">
          <span className="stat-title">Net</span>
          <span className={`stat-value tabular ${net < 0 ? "text-warning" : "text-success"}`}>
            {formatUSD(net)}
          </span>
        </div>
      </div>

      <p className="max-w-prose font-bold">
        {nothingYet
          ? "Nothing to add up yet. Log what the cart cost to start, and sales fill in on their own."
          : net >= 0
            ? `The cart has paid back everything spent on it, with ${formatUSD(net)} to spare.`
            : `The cart still has ${formatUSD(-net)} to go before it has paid back what was spent on it.`}
      </p>

      {nothingYet ? null : (
        <div
          role="region"
          aria-label="By month"
          tabIndex={0}
          className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
        >
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Spent</th>
                <th className="text-right">Net</th>
                <th className="text-right">Running total</th>
              </tr>
            </thead>
            <tbody>
              {ledger.months.map((month) => (
                <tr key={month.month}>
                  <td className="font-bold">{monthLabel(month.month)}</td>
                  <td className="text-right tabular">{formatUSD(month.soldCents)}</td>
                  <td className="text-right tabular">{formatUSD(month.spentCents)}</td>
                  <td className="text-right tabular">{formatUSD(month.netCents)}</td>
                  <td
                    className={`text-right font-bold tabular ${
                      month.runningNetCents < 0 ? "text-warning" : "text-success"
                    }`}
                  >
                    {formatUSD(month.runningNetCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
