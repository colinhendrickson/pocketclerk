"use client";

import { useState, useTransition } from "react";

import { formatUSD } from "@/lib/money";
import { dollarsToCents, type MenuKind } from "@/lib/validate";

import {
  createMenuEntry,
  setMenuEntryActive,
  setMenuItemSpecial,
  updateMenuEntry,
} from "./actions";

export interface MenuEntryView {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
  /** Menu items only. Add-ons have no such column, and pass null. */
  isSpecial: boolean | null;
}

export interface MenuSectionProps {
  kind: MenuKind;
  title: string;
  /** One line under the heading explaining what this list is for. */
  description: string;
  addLabel: string;
  rows: MenuEntryView[];
}

/**
 * Turns integer cents into the string the price input starts with.
 *
 * Not `formatUSD`: that produces "$3.50", and a dollar sign sitting in an edit
 * field is something the administrator has to delete before typing. The value
 * still round-trips through `dollarsToCents`, which is the only conversion that
 * matters.
 */
function centsToInputValue(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * One of the two menu lists.
 *
 * Both lists are the same table with one extra column, so they share a
 * component and differ by `kind`. That keeps the price-entry rules — the one
 * genuinely delicate part of this page — written once.
 *
 * Prices are typed in dollars and converted to cents before the payload is
 * built, so the dollar figure never exists anywhere but the input box. The
 * conversion is `dollarsToCents`, which parses the string rather than
 * multiplying a float; see the note on that function for why that distinction
 * decides what a teacher is charged.
 */
export function MenuSection({
  kind,
  title,
  description,
  addLabel,
  rows,
}: MenuSectionProps) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section data-tour={kind === "item" ? "menu-items" : "add-ons"} className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="text-sm opacity-70">{description}</p>
      </header>

      <AddEntryForm kind={kind} label={addLabel} />

      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th className="text-right">Price</th>
              {kind === "item" ? <th>Special</th> : null}
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <EntryRow
                key={row.id}
                kind={kind}
                row={row}
                isEditing={editing === row.id}
                onToggleEdit={() =>
                  setEditing((current) => (current === row.id ? null : row.id))
                }
              />
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={kind === "item" ? 5 : 4} className="py-6 text-center opacity-70">
                  Nothing here yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface AddEntryFormProps {
  kind: MenuKind;
  label: string;
}

function AddEntryForm({ kind, label }: AddEntryFormProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priceCents = dollarsToCents(price);
  const badPrice = price !== "" && priceCents === null;
  const ready = name.trim().length >= 2 && priceCents !== null;

  function submit() {
    setError(null);
    if (priceCents === null) return;
    startTransition(async () => {
      const result = await createMenuEntry({
        kind,
        name,
        // Sent as cents. The action's signature accepts nothing else, so the
        // dollar string stops here.
        price: priceCents,
        isSpecial: kind === "item" ? isSpecial : false,
      });
      if (result.ok) {
        setName("");
        setPrice("");
        setIsSpecial(false);
        return;
      }
      setError(
        result.error === "duplicate"
          ? "Something on this list already has that name."
          : "Check the name and the price.",
      );
    });
  }

  return (
    <form
      className="flex flex-wrap items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="input input-bordered input-sm w-56"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Price in dollars</span>
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder="1.50"
          autoComplete="off"
          aria-invalid={badPrice}
          aria-describedby={`${kind}-price-hint${badPrice ? ` ${kind}-price-error` : ""}`}
          className={`input input-bordered input-sm w-28 tabular ${badPrice ? "input-error" : ""}`}
        />
        <span id={`${kind}-price-hint`} className="text-sm opacity-70">
          {kind === "addon" ? "Like 0.50. Free extras are 0.00." : "Like 1.50."}
        </span>
      </label>

      {kind === "item" ? (
        <label className="mt-6 flex h-8 items-center gap-2">
          <input
            type="checkbox"
            checked={isSpecial}
            onChange={(event) => setIsSpecial(event.target.checked)}
            aria-describedby="item-special-hint"
            className="checkbox checkbox-sm"
          />
          <span className="text-sm font-bold opacity-70">Special</span>
          <span id="item-special-hint" className="sr-only">
            Shown to students as this week&rsquo;s special treat.
          </span>
        </label>
      ) : null}

      <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm mt-6">
        {pending ? "Adding…" : label}
      </button>

      {badPrice ? (
        <p id={`${kind}-price-error`} className="w-full text-sm font-bold text-error">
          Prices are dollars and cents, like 1.50. Two decimal places at most.
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

interface EntryRowProps {
  kind: MenuKind;
  row: MenuEntryView;
  isEditing: boolean;
  onToggleEdit: () => void;
}

function EntryRow({ kind, row, isEditing, onToggleEdit }: EntryRowProps) {
  const [name, setName] = useState(row.name);
  const [price, setPrice] = useState(centsToInputValue(row.priceCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priceCents = dollarsToCents(price);
  const ready = name.trim().length >= 2 && priceCents !== null;

  function save() {
    setError(null);
    if (priceCents === null) return;
    startTransition(async () => {
      const result = await updateMenuEntry({ kind, id: row.id, name, price: priceCents });
      if (result.ok) {
        onToggleEdit();
        return;
      }
      setError("That did not save. Check the name and the price.");
    });
  }

  /**
   * Cancelling restores the stored values rather than leaving the abandoned
   * text in the fields. The row is not remounted when the form closes, so
   * without this the next "Edit" would reopen on the edit nobody wanted.
   */
  function cancel() {
    setName(row.name);
    setPrice(centsToInputValue(row.priceCents));
    setError(null);
    onToggleEdit();
  }

  function toggleActive() {
    startTransition(async () => {
      await setMenuEntryActive({ kind, id: row.id, value: !row.active });
    });
  }

  function toggleSpecial() {
    startTransition(async () => {
      await setMenuItemSpecial({ kind, id: row.id, value: !row.isSpecial });
    });
  }

  if (isEditing) {
    return (
      <tr className="bg-base-200">
        <td>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`Name for ${row.name}`}
            autoComplete="off"
            className="input input-bordered input-sm w-full"
          />
        </td>
        <td>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            aria-label={`Price in dollars for ${row.name}`}
            autoComplete="off"
            className={`input input-bordered input-sm w-28 text-right tabular ${
              priceCents === null ? "input-error" : ""
            }`}
          />
        </td>
        {kind === "item" ? <td /> : null}
        <td>
          {error ? (
            <span role="alert" className="text-sm font-bold text-error">
              {error}
            </span>
          ) : null}
        </td>
        <td>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!ready || pending}
              className="btn btn-primary btn-xs"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} className="btn btn-ghost btn-xs">
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={row.active ? undefined : "opacity-75"}>
      <td className="font-bold">{row.name}</td>
      <td className="text-right tabular">{formatUSD(row.priceCents)}</td>
      {kind === "item" ? (
        <td>
          <button
            type="button"
            onClick={toggleSpecial}
            disabled={pending}
            aria-pressed={row.isSpecial === true}
            className={`btn btn-xs ${row.isSpecial ? "btn-secondary" : "btn-ghost"}`}
          >
            {row.isSpecial ? "Special" : "Mark special"}
          </button>
        </td>
      ) : null}
      <td>
        <span className={`badge badge-sm whitespace-nowrap ${row.active ? "badge-success" : "badge-ghost"}`}>
          {row.active ? "On the menu" : "Off the menu"}
        </span>
      </td>
      <td>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onToggleEdit} className="btn btn-ghost btn-xs">
            Edit
          </button>
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className={`btn btn-xs ${row.active ? "btn-outline" : "btn-outline btn-success"}`}
          >
            {row.active ? "Take off" : "Put back"}
          </button>
        </div>
      </td>
    </tr>
  );
}
