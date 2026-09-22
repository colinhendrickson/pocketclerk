"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BigButton } from "@/components";
import { restockNeeded, usedCount, type CountRow } from "@/lib/inventory-rules";

import { countItem, markRestocked } from "../../inventory-actions";

export interface InventorySheetProps {
  initialRows: CountRow[];
}

/**
 * Counting what is left, then restocking it.
 *
 * Counting is by plus and minus rather than typed entry, because the student is
 * counting physical objects and the number on screen should move the way the
 * pile does. Each tap is one unit; the starting figure caps it, so the count
 * can never claim more than the cart began with.
 *
 * "Used" is shown but never entered. It is the difference between the start and
 * the count, and seeing it appear is the point: a gap between what was sold and
 * what is gone is a real thing worth noticing.
 */
export function InventorySheet({ initialRows }: InventorySheetProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  const counted = rows.filter((r) => r.remaining !== null).length;
  const allCounted = counted === rows.length;
  const toRestock = rows.filter((r) => restockNeeded(r) > 0);
  const restockDone = toRestock.every((r) => r.restocked);

  function setRemaining(row: CountRow, next: number) {
    const clamped = Math.max(0, Math.min(row.starting, next));
    setRows((current) =>
      current.map((r) => (r.itemId === row.itemId ? { ...r, remaining: clamped } : r)),
    );
    startTransition(async () => {
      const result = await countItem(row.itemId, clamped);
      if (result.ok) setRows(result.rows);
      else if (result.error === "no_shift") router.replace("/");
    });
  }

  function toggleRestock(row: CountRow) {
    const next = !row.restocked;
    setRows((current) =>
      current.map((r) => (r.itemId === row.itemId ? { ...r, restocked: next } : r)),
    );
    startTransition(async () => {
      const result = await markRestocked(row.itemId, next);
      if (result.ok) setRows(result.rows);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <p className="text-[22px] font-bold">
        Count what is left on the cart. {counted} of {rows.length} done.
      </p>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const used = usedCount(row);
          return (
            <li
              key={row.itemId}
              className="flex flex-wrap items-center gap-4 rounded-box border border-base-300 bg-base-100 p-4"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-[26px] font-extrabold">{row.name}</p>
                <p className="text-[18px] font-bold opacity-70">
                  Started with <span className="tabular">{row.starting}</span>{" "}
                  {row.unit}
                  {used !== null ? (
                    <>
                      {" · used "}
                      <span className="tabular">{used}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`One fewer ${row.name}`}
                  disabled={pending}
                  onClick={() => setRemaining(row, (row.remaining ?? row.starting) - 1)}
                  className="btn size-[60px] rounded-field bg-base-200"
                >
                  <Minus size={28} aria-hidden="true" />
                </button>
                <span className="min-w-[3ch] text-center text-[34px] font-extrabold tabular">
                  {row.remaining ?? "—"}
                </span>
                <button
                  type="button"
                  aria-label={`One more ${row.name}`}
                  disabled={pending}
                  onClick={() => setRemaining(row, (row.remaining ?? row.starting) + 1)}
                  className="btn size-[60px] rounded-field bg-base-200"
                >
                  <Plus size={28} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {allCounted && toRestock.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6">
          <h2 className="text-[26px] font-extrabold">Restock these</h2>
          <ul className="flex flex-col gap-3">
            {toRestock.map((row) => (
              <li key={row.itemId} className="flex flex-wrap items-center gap-4">
                <span className="flex-1 text-[22px] font-extrabold">
                  {row.name}
                  <span className="opacity-70">
                    {" — add "}
                    <span className="tabular">{restockNeeded(row)}</span> {row.unit}
                  </span>
                </span>
                <button
                  type="button"
                  aria-pressed={row.restocked}
                  disabled={pending}
                  onClick={() => toggleRestock(row)}
                  className={`btn min-h-[60px] text-[20px] font-extrabold ${
                    row.restocked ? "btn-success" : "btn-outline btn-secondary"
                  }`}
                >
                  {row.restocked ? <Check size={24} aria-hidden="true" /> : null}
                  {row.restocked ? "Restocked" : "Mark restocked"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {allCounted && toRestock.length === 0 ? (
        <p className="alert alert-success rounded-box text-[22px] font-extrabold">
          Everything is full. Nothing to restock.
        </p>
      ) : null}

      <BigButton
        variant="primary"
        disabled={!allCounted || !restockDone}
        onClick={() => router.push("/shift/clock-out")}
        className="mt-auto"
      >
        {allCounted
          ? restockDone
            ? "Done, go to clock out"
            : "Restock the items above first"
          : "Count every item first"}
      </BigButton>
    </div>
  );
}
