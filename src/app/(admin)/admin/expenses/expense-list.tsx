"use client";

import { useState, useTransition } from "react";

import type { ExpenseRow } from "@/lib/expenses";
import { formatUSD } from "@/lib/money";
import { cartFormatter, type LocalDate } from "@/lib/time";
import { dollarsToCents, EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/validate";

import { createExpense, setExpenseActive, updateExpense, type ExpenseResult } from "./actions";

const ERRORS: Record<Exclude<ExpenseResult, { ok: true }>["error"], string> = {
  invalid: "Check the date, what it was, and that the amount is dollars and cents like 12.50.",
  not_found: "That expense no longer exists. Reload the page.",
};

/** How each category reads on the page. */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  product: "Product",
  supplies: "Cups and supplies",
  equipment: "Equipment",
  treat: "Special treat",
  other: "Other",
};

/** "2026-09-14" as "Sep 14, 2026". Noon UTC keeps the day the same in every zone. */
function dateLabel(date: LocalDate): string {
  return cartFormatter({ month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ExpenseList({ expenses, today }: { expenses: ExpenseRow[]; today: LocalDate }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section aria-labelledby="expenses-heading" className="flex flex-col gap-3">
      <h2 id="expenses-heading" className="text-xl font-extrabold">
        What was spent
      </h2>

      <AddExpenseForm today={today} />

      <div
        role="region"
        aria-label="Expenses"
        tabIndex={0}
        data-tour="expenses"
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>What</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
              <th>Logged by</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) =>
              editing === expense.id ? (
                <EditRow key={expense.id} expense={expense} onDone={() => setEditing(null)} />
              ) : (
                <ExpenseRowView
                  key={expense.id}
                  expense={expense}
                  onEdit={() => setEditing(expense.id)}
                />
              ),
            )}
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center opacity-70">
                  Nothing logged yet. Start with what the cart cost to set up, such as the coffee
                  pots.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CategorySelect({
  value,
  onChange,
  label,
}: {
  value: ExpenseCategory;
  onChange: (value: ExpenseCategory) => void;
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ExpenseCategory)}
      aria-label={label}
      className="select select-bordered select-sm w-44"
    >
      {EXPENSE_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {CATEGORY_LABELS[category]}
        </option>
      ))}
    </select>
  );
}

function AddExpenseForm({ today }: { today: LocalDate }) {
  const [spentOn, setSpentOn] = useState<string>(today);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("product");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amountCents = dollarsToCents(amount);
  const badAmount = amount.trim() !== "" && (amountCents === null || amountCents === 0);
  const ready =
    description.trim().length >= 2 && amountCents !== null && amountCents > 0 && spentOn !== "";

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createExpense({ spentOn, description, category, amountCents, note });
      if (result.ok) {
        setDescription("");
        setAmount("");
        setNote("");
      } else {
        setError(ERRORS[result.error]);
      }
    });
  }

  return (
    <form
      data-tour="add-expense"
      className="flex flex-wrap items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Date</span>
        <input
          type="date"
          value={spentOn}
          onChange={(event) => setSpentOn(event.target.value)}
          className="input input-bordered input-sm w-40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">What</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Coffee pots"
          autoComplete="off"
          className="input input-bordered input-sm w-56"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Category</span>
        <CategorySelect value={category} onChange={setCategory} label="Category" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Amount in dollars</span>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="24.99"
          autoComplete="off"
          aria-invalid={badAmount}
          aria-describedby={`expense-amount-hint${badAmount ? " expense-amount-error" : ""}`}
          className={`input input-bordered input-sm w-28 tabular ${badAmount ? "input-error" : ""}`}
        />
        <span id="expense-amount-hint" className="text-sm opacity-70">
          Like 24.99.
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Note</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional, such as where it was bought"
          autoComplete="off"
          className="input input-bordered input-sm w-64"
        />
      </label>
      <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm mt-6">
        {pending ? "Adding…" : "Add expense"}
      </button>
      {badAmount ? (
        <p id="expense-amount-error" className="w-full text-sm font-bold text-error">
          Amounts are dollars and cents, like 24.99, and more than nothing.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ExpenseRowView({ expense, onEdit }: { expense: ExpenseRow; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setExpenseActive({ id: expense.id, active: !expense.active });
      if (!result.ok) setError(ERRORS[result.error]);
    });
  }

  return (
    <tr className={expense.active ? undefined : "opacity-75"}>
      <td className="whitespace-nowrap tabular">{dateLabel(expense.spentOn)}</td>
      <td>
        <span className="font-bold">{expense.description}</span>
        {expense.note ? <span className="block text-sm opacity-70">{expense.note}</span> : null}
      </td>
      <td className="whitespace-nowrap">{CATEGORY_LABELS[expense.category]}</td>
      <td className="text-right tabular">{formatUSD(expense.amountCents)}</td>
      <td className="whitespace-nowrap">{expense.loggedBy}</td>
      <td>
        <span
          className={`badge badge-sm whitespace-nowrap ${expense.active ? "badge-success" : "badge-ghost"}`}
        >
          {expense.active ? "Counted" : "Taken off"}
        </span>
        {error ? (
          <span role="alert" className="block text-sm font-bold text-error">
            {error}
          </span>
        ) : null}
      </td>
      <td>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onEdit} className="btn btn-ghost btn-xs">
            Edit
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={`btn btn-xs ${expense.active ? "btn-outline" : "btn-outline btn-success"}`}
          >
            {expense.active ? "Take off" : "Put back"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditRow({ expense, onDone }: { expense: ExpenseRow; onDone: () => void }) {
  const [spentOn, setSpentOn] = useState<string>(expense.spentOn);
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [amount, setAmount] = useState(centsToDollars(expense.amountCents));
  const [note, setNote] = useState(expense.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateExpense({
        id: expense.id,
        spentOn,
        description,
        category,
        amountCents: dollarsToCents(amount),
        note,
      });
      if (result.ok) onDone();
      else setError(ERRORS[result.error]);
    });
  }

  return (
    <tr className="bg-base-200">
      <td>
        <input
          type="date"
          value={spentOn}
          onChange={(event) => setSpentOn(event.target.value)}
          aria-label={`Date for ${expense.description}`}
          className="input input-bordered input-sm w-40"
        />
      </td>
      <td>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-label={`What, for ${expense.description}`}
          autoComplete="off"
          className="input input-bordered input-sm w-full min-w-40"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label={`Note for ${expense.description}`}
          placeholder="Note"
          autoComplete="off"
          className="input input-bordered input-sm mt-1 w-full min-w-40"
        />
      </td>
      <td>
        <CategorySelect
          value={category}
          onChange={setCategory}
          label={`Category for ${expense.description}`}
        />
      </td>
      <td>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          aria-label={`Amount in dollars for ${expense.description}`}
          autoComplete="off"
          className="input input-bordered input-sm w-24 text-right tabular"
        />
      </td>
      <td className="whitespace-nowrap">{expense.loggedBy}</td>
      <td>
        {error ? (
          <span role="alert" className="text-sm font-bold text-error">
            {error}
          </span>
        ) : null}
      </td>
      <td>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-xs">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDone} className="btn btn-ghost btn-xs">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
