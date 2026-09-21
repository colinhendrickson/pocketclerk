"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  BigButton,
  BillButtons,
  ChangeCard,
  Keypad,
  MoneyDisplay,
  NoteBanner,
  StepHeader,
  TeacherCard,
} from "@/components";
import type { Addon, MenuItem } from "@/db/schema";
import { formatUSD, orderTotalCents } from "@/lib/money";
import type { TeacherSummary } from "@/lib/queries";

import { completeOrder } from "../../actions";

const STEPS = ["Teacher", "Order", "Pay", "Receipt"] as const;

export interface OrderFlowProps {
  teachers: TeacherSummary[];
  menu: MenuItem[];
  addons: Addon[];
}

/** One menu item in the order, with the add-ons chosen for it. */
interface Line {
  menuItemId: string;
  qty: number;
  addonIds: string[];
}

type Stage = "teacher" | "build" | "pay" | "done";

interface Completed {
  totalCents: number;
  changeCents: number;
}

/**
 * The whole classroom order, as four screens with one job each.
 *
 * The order is held in client state and committed in a single server action at
 * the end. Nothing half-finished reaches the database: there is no such thing
 * as a draft order to clean up, and a student who walks away mid-order leaves
 * no trace.
 *
 * The running total shown here is a preview for the student. The server
 * recomputes every figure from its own prices before writing anything, so what
 * is displayed can never become what is charged.
 */
export function OrderFlow({ teachers, menu, addons }: OrderFlowProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("teacher");
  const [teacher, setTeacher] = useState<TeacherSummary | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [entry, setEntry] = useState("");
  const [selectedBill, setSelectedBill] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [pending, startTransition] = useTransition();

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const addonById = useMemo(() => new Map(addons.map((a) => [a.id, a])), [addons]);

  const totalCents = useMemo(
    () =>
      orderTotalCents(
        lines.map((line) => ({
          unitPriceCents: menuById.get(line.menuItemId)?.priceCents ?? 0,
          qty: line.qty,
          addonPriceCents: line.addonIds.map((id) => addonById.get(id)?.priceCents ?? 0),
        })),
      ),
    [lines, menuById, addonById],
  );

  const receivedCents = entry === "" ? 0 : Number.parseInt(entry, 10);
  const enough = entry !== "" && receivedCents >= totalCents;

  function addItem(menuItemId: string) {
    setLines((current) => {
      const existing = current.find(
        (l) => l.menuItemId === menuItemId && l.addonIds.length === 0,
      );
      if (existing) {
        return current.map((l) =>
          l === existing ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...current, { menuItemId, qty: 1, addonIds: [] }];
    });
  }

  function removeItem(menuItemId: string) {
    setLines((current) =>
      current
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }

  /** Add-ons attach to the most recently added line, which is the one on screen. */
  function toggleAddon(addonId: string) {
    setLines((current) => {
      if (current.length === 0) return current;
      const last = current.length - 1;
      return current.map((line, i) => {
        if (i !== last) return line;
        const has = line.addonIds.includes(addonId);
        return {
          ...line,
          addonIds: has
            ? line.addonIds.filter((id) => id !== addonId)
            : [...line.addonIds, addonId],
        };
      });
    });
  }

  function submit() {
    if (!teacher) return;
    setError(null);
    startTransition(async () => {
      const result = await completeOrder({
        teacherId: teacher.id,
        receivedCents,
        lines,
      });
      if (result.ok) {
        setCompleted({ totalCents: result.totalCents, changeCents: result.changeCents });
        setStage("done");
      } else if (result.error === "no_shift") {
        router.replace("/");
      } else if (result.error === "insufficient") {
        setError("That is not enough money for this order. Count it again.");
      } else {
        setError("The order did not save. Ask a teacher for help.");
      }
    });
  }

  function startNextOrder() {
    setTeacher(null);
    setLines([]);
    setEntry("");
    setSelectedBill(null);
    setCompleted(null);
    setError(null);
    setStage("teacher");
  }

  /* --- Step 1: who is buying ---------------------------------------------- */
  if (stage === "teacher") {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={1}
          totalSteps={4}
          title="Who is buying?"
          backHref="/shift"
          backLabel="Back to your shift"
          steps={STEPS}
        />
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <TeacherCard
              key={t.id}
              name={t.name}
              room={t.room ? `Room ${t.room}` : undefined}
              noteCount={t.notes.length}
              onSelect={() => {
                setTeacher(t);
                setStage("build");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* --- Step 2: build the order -------------------------------------------- */
  if (stage === "build" && teacher) {
    const lastLine = lines[lines.length - 1];
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={2}
          totalSteps={4}
          title="Build the order"
          subtitle={teacher.room ? `${teacher.name} · Room ${teacher.room}` : teacher.name}
          backLabel="Back to teachers"
          steps={STEPS}
          onBack={() => setStage("teacher")}
        />

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:grid lg:grid-cols-[1fr_400px] lg:items-start">
          <div className="flex flex-col gap-4">
            {/* Notes sit above the menu, never below it and never collapsed.
                Remembering the customer is the lesson; the layout enforces it. */}
            {teacher.notes.map((note) => (
              <NoteBanner key={note}>
                Note for {teacher.name}: {note}
              </NoteBanner>
            ))}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {menu.map((item) => {
                const qty = lines
                  .filter((l) => l.menuItemId === item.id)
                  .reduce((n, l) => n + l.qty, 0);
                return (
                  <div
                    key={item.id}
                    className="flex min-h-[110px] items-center gap-4 rounded-box border border-base-300 bg-base-100 p-4"
                  >
                    <div className="flex-1">
                      <p className="text-[26px] font-extrabold">{item.name}</p>
                      {item.isSpecial ? (
                        <p className="text-[15px] font-bold text-accent">Special treat</p>
                      ) : null}
                      <p className="text-[20px] font-bold tabular">
                        {formatUSD(item.priceCents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Remove one ${item.name}`}
                            onClick={() => removeItem(item.id)}
                            className="btn size-[60px] rounded-field bg-base-200"
                          >
                            <Minus size={28} aria-hidden="true" />
                          </button>
                          <span className="min-w-[2ch] text-center text-[26px] font-extrabold tabular">
                            {qty}
                          </span>
                        </>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => addItem(item.id)}
                        className="btn btn-primary size-[60px] rounded-field"
                      >
                        <Plus size={28} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {lastLine ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[18px] font-bold opacity-70">Add-ons</span>
                {addons.map((addon) => {
                  const on = lastLine.addonIds.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAddon(addon.id)}
                      className={`btn min-h-[60px] rounded-field text-[20px] font-extrabold ${
                        on ? "btn-secondary" : "btn-outline btn-secondary"
                      }`}
                    >
                      {on ? <Check size={22} aria-hidden="true" /> : null}
                      {addon.name}
                      {addon.priceCents > 0 ? ` (${formatUSD(addon.priceCents)})` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6 lg:sticky lg:top-6">
            <ul className="flex flex-col gap-2">
              {lines.map((line, i) => {
                const item = menuById.get(line.menuItemId);
                if (!item) return null;
                return (
                  <li key={`${line.menuItemId}-${i}`} className="flex flex-col">
                    <span className="flex justify-between text-[22px] font-extrabold">
                      <span>
                        {line.qty} × {item.name}
                      </span>
                      <span className="tabular">
                        {formatUSD(item.priceCents * line.qty)}
                      </span>
                    </span>
                    {line.addonIds.map((id) => {
                      const addon = addonById.get(id);
                      if (!addon) return null;
                      return (
                        <span
                          key={id}
                          className="flex justify-between pl-4 text-[18px] font-bold opacity-80"
                        >
                          <span>{addon.name}</span>
                          <span className="tabular">
                            {formatUSD(addon.priceCents * line.qty)}
                          </span>
                        </span>
                      );
                    })}
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto border-t border-base-300 pt-4">
              <p className="text-[18px] font-bold opacity-70">Total</p>
              <MoneyDisplay cents={totalCents} size="running" />
            </div>

            <BigButton
              variant="primary"
              disabled={lines.length === 0}
              onClick={() => setStage("pay")}
            >
              Go to payment
            </BigButton>
          </aside>
        </div>
      </div>
    );
  }

  /* --- Step 3: take the money and make change ------------------------------ */
  if (stage === "pay" && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={3}
          totalSteps={4}
          title="Make change"
          subtitle={`${teacher.name} owes ${formatUSD(totalCents)}`}
          backLabel="Back to the order"
          steps={STEPS}
          onBack={() => setStage("build")}
        />

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:grid lg:grid-cols-[1fr_420px] lg:items-start">
          <div className="flex flex-col gap-4">
            <table className="table rounded-box bg-base-100 text-[22px] font-extrabold">
              <tbody>
                <tr>
                  <td>Amount owed</td>
                  <td className="text-right tabular">{formatUSD(totalCents)}</td>
                </tr>
                <tr>
                  <td>Money received</td>
                  <td className="text-right tabular">{formatUSD(receivedCents)}</td>
                </tr>
              </tbody>
            </table>

            {/* The answer stays above the keypad so it is visible while the
                student is still counting, not after they finish. */}
            {enough ? <ChangeCard changeCents={receivedCents - totalCents} /> : null}

            {error ? (
              <p role="alert" className="alert alert-warning rounded-box text-[22px] font-extrabold">
                {error}
              </p>
            ) : null}

            <BigButton variant="primary" disabled={!enough || pending} onClick={submit}>
              {pending ? "Saving…" : "Change given, print receipt"}
            </BigButton>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[18px] font-bold opacity-70">Bills handed to you</p>
            <BillButtons
              selectedCents={selectedBill}
              onSelect={(cents) => {
                setSelectedBill(cents);
                setEntry(String(cents));
              }}
            />
            <Keypad
              onDigit={(digit) => {
                setSelectedBill(null);
                setEntry((current) => appendDigit(current, digit));
              }}
              onBackspace={() => {
                setSelectedBill(null);
                setEntry((current) => current.slice(0, -1));
              }}
              onClear={() => {
                setSelectedBill(null);
                setEntry("");
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* --- Step 4: done -------------------------------------------------------- */
  if (stage === "done" && completed && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader step={4} totalSteps={4} title="Order done" steps={STEPS} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <span className="grid size-[150px] place-items-center rounded-full bg-success text-success-content">
            <Check size={80} aria-hidden="true" />
          </span>
          <h2 className="text-[44px] font-extrabold text-success">Change given</h2>
          <p className="text-[22px] font-bold">
            {teacher.name} paid {formatUSD(completed.totalCents + completed.changeCents)}
            {" · "}change {formatUSD(completed.changeCents)}
            {" · "}receipt is on its way
          </p>
          <div className="flex w-full max-w-xl flex-col gap-4">
            <BigButton variant="primary" onClick={startNextOrder}>
              Done, next order
            </BigButton>
            <BigButton onClick={() => router.push("/shift")}>
              Back to your shift
            </BigButton>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Appends a keypad digit to the cents entry, the way a card terminal works:
 * tapping 5, 0, 0 means $5.00, so there is no decimal point to place or to put
 * in the wrong spot. Leading zeroes are dropped and the entry is capped at six
 * digits, which is far past any plausible coffee order.
 */
function appendDigit(current: string, digit: string): string {
  const next = (current + digit).replace(/^0+(?=\d)/, "");
  return next.length > 6 ? current : next;
}
