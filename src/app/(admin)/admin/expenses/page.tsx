import { getMoneyLedger, listExpenses } from "@/lib/expenses";
import { today } from "@/lib/time";

import { HelpPanel } from "../_help/help-panel";
import { requireAdmin } from "../require-admin";
import { ExpenseList } from "./expense-list";
import { MoneyLedger } from "./money-ledger";

export const dynamic = "force-dynamic";

/** What the cart spends, set against what it sells. */
export default async function AdminExpensesPage() {
  await requireAdmin();
  const [ledger, rows] = await Promise.all([getMoneyLedger(), listExpenses()]);

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Expenses</h1>
        <p className="opacity-70">
          What the cart spends, from the coffee pots on day one to this week&rsquo;s cups, set
          against what it sells.
        </p>
      </header>

      <HelpPanel route="/admin/expenses" />

      <MoneyLedger ledger={ledger} />

      <ExpenseList expenses={rows} today={today()} />
    </main>
  );
}
