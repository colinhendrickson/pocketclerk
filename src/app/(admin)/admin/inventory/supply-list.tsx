"use client";

import { useState, useTransition } from "react";

import type { SupplyRow } from "@/lib/admin-queries";

import { createSupply, setSupplyActive, updateSupply, type SupplyResult } from "./actions";

const ERRORS: Record<Exclude<SupplyResult, { ok: true }>["error"], string> = {
  invalid: "Check the name, and that the full cart amount is a whole number.",
  duplicate: "There is already a supply with that name.",
  not_found: "That supply no longer exists. Reload the page.",
};

/** Whole numbers only; anything else becomes NaN, which the server refuses. */
function toCount(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
}

export function SupplyList({ supplies }: { supplies: SupplyRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <AddSupplyForm />

      <div
        role="region"
        aria-label="Supplies"
        tabIndex={0}
        data-tour="supplies"
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Supply</th>
              <th>Counted in</th>
              <th className="text-right">Full cart</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {supplies.map((supply) =>
              editing === supply.id ? (
                <EditRow key={supply.id} supply={supply} onDone={() => setEditing(null)} />
              ) : (
                <SupplyRowView key={supply.id} supply={supply} onEdit={() => setEditing(supply.id)} />
              ),
            )}
            {supplies.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center opacity-70">
                  No supplies yet. Add the first one above, such as coffee cups.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddSupplyForm() {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const count = toCount(parLevel);
  const ready = name.trim().length >= 2 && count > 0;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSupply({ name, unit, parLevel: count });
      if (result.ok) {
        setName("");
        setUnit("");
        setParLevel("");
      } else {
        setError(ERRORS[result.error]);
      }
    });
  }

  return (
    <form
      data-tour="add-supply"
      className="flex flex-wrap items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Supply</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Coffee cups"
          autoComplete="off"
          className="input input-bordered input-sm w-56"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Counted in</span>
        <input
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="cups"
          autoComplete="off"
          className="input input-bordered input-sm w-32"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Full cart</span>
        <input
          value={parLevel}
          onChange={(event) => setParLevel(event.target.value)}
          inputMode="numeric"
          placeholder="50"
          autoComplete="off"
          aria-describedby="supply-par-hint"
          className="input input-bordered input-sm w-24 tabular"
        />
        <span id="supply-par-hint" className="text-sm opacity-70">
          How many a full cart holds.
        </span>
      </label>
      <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm mt-6">
        {pending ? "Adding…" : "Add supply"}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function SupplyRowView({ supply, onEdit }: { supply: SupplyRow; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setSupplyActive({ id: supply.id, active: !supply.active });
      if (!result.ok) setError(ERRORS[result.error]);
    });
  }

  return (
    <tr className={supply.active ? undefined : "opacity-75"}>
      <td className="font-bold">{supply.name}</td>
      <td>{supply.unit}</td>
      <td className="text-right tabular">{supply.parLevel}</td>
      <td>
        <span
          className={`badge badge-sm whitespace-nowrap ${supply.active ? "badge-success" : "badge-ghost"}`}
        >
          {supply.active ? "Counted" : "Not counted"}
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
            className={`btn btn-xs ${supply.active ? "btn-outline" : "btn-outline btn-success"}`}
          >
            {supply.active ? "Take off" : "Put back"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditRow({ supply, onDone }: { supply: SupplyRow; onDone: () => void }) {
  const [name, setName] = useState(supply.name);
  const [unit, setUnit] = useState(supply.unit);
  const [parLevel, setParLevel] = useState(String(supply.parLevel));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSupply({ id: supply.id, name, unit, parLevel: toCount(parLevel) });
      if (result.ok) onDone();
      else setError(ERRORS[result.error]);
    });
  }

  return (
    <tr className="bg-base-200">
      <td>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Name for ${supply.name}`}
          autoComplete="off"
          className="input input-bordered input-sm w-full"
        />
      </td>
      <td>
        <input
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          aria-label={`Counted in, for ${supply.name}`}
          autoComplete="off"
          className="input input-bordered input-sm w-28"
        />
      </td>
      <td>
        <input
          value={parLevel}
          onChange={(event) => setParLevel(event.target.value)}
          inputMode="numeric"
          aria-label={`Full cart amount for ${supply.name}`}
          autoComplete="off"
          className="input input-bordered input-sm w-20 text-right tabular"
        />
      </td>
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
