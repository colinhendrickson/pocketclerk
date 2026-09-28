"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  BigButton,
  BillButtons,
  ChangeCard,
  Keypad,
  MenuIcon,
  MoneyDisplay,
  NoteBanner,
  PaymentChoice,
  StaffCardCheck,
  StepHeader,
} from "@/components";
import type { Addon, MenuItem } from "@/db/schema";
import { isMenuIconKey } from "@/lib/menu-icons";
import { formatUSD, orderTotalCents } from "@/lib/money";
import type { TeacherSummary } from "@/lib/queries";
import { MAX_RECEIVED_CENTS } from "@/lib/validate";

import { completeOrder } from "../../actions";
import { TeacherPicker } from "./teacher-picker";

const STEPS = ["Teacher", "Order", "Pay", "Receipt"] as const;

export interface OrderFlowProps {
  teachers: TeacherSummary[];
  menu: MenuItem[];
  addons: Addon[];
  /** When false the order goes straight to making change, as before 3.7. */
  cardPaymentsEnabled: boolean;
}

/** One menu item in the order, with the add-ons chosen for it. */
interface Line {
  menuItemId: string;
  qty: number;
  addonIds: string[];
}

/** `method` asks how the teacher pays; `pay` makes change; `card` checks a staff card. */
type Stage = "teacher" | "build" | "method" | "pay" | "card" | "done";

interface Completed {
  totalCents: number;
  /** Null when paid by staff card. */
  changeCents: number | null;
}

/**
 * The classroom order as four single-purpose steps. The order lives in client
 * state and is committed by one server action at the end, so abandoned orders
 * leave nothing in the database. Totals shown here are a preview; the server
 * recomputes them from its own prices.
 */
export function OrderFlow({
  teachers,
  menu,
  addons,
  cardPaymentsEnabled,
}: OrderFlowProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("teacher");
  const [teacher, setTeacher] = useState<TeacherSummary | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [entry, setEntry] = useState("");
  const [selectedBill, setSelectedBill] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Completed | null>(null);
  // One id per order, reused on retry so a lost response cannot record the sale twice.
  const [orderId, setOrderId] = useState(() => crypto.randomUUID());
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

  function submit(paymentMethod: "cash" | "card") {
    if (!teacher) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof completeOrder>>;
      try {
        result = await completeOrder(
          paymentMethod === "cash"
            ? { orderId, teacherId: teacher.id, paymentMethod, receivedCents, lines }
            : { orderId, teacherId: teacher.id, paymentMethod, lines },
        );
      } catch {
        // The sale may have saved before the connection dropped; the order stays on screen.
        setError("Something went wrong. Check Today's orders before trying again.");
        return;
      }
      if (result.ok) {
        // Shown from the recorded order: a retry may return a sale first saved another way.
        setCompleted({ totalCents: result.totalCents, changeCents: result.changeCents });
        setStage("done");
      } else if (result.error === "no_shift") {
        router.replace("/cart");
      } else if (result.error === "insufficient") {
        setError("That is not enough money for this order. Count it again.");
      } else if (result.error === "card_disabled") {
        // Staff turned card payments off mid-sale; cash still works.
        setError("Staff cards are turned off. Take cash instead.");
        setStage("pay");
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
    setOrderId(crypto.randomUUID());
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
        <TeacherPicker
          teachers={teachers}
          onPick={(picked) => {
            setTeacher(picked);
            setStage("build");
          }}
        />
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

        {/* Bottom padding clears the fixed order sheet below md. */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pb-[260px] md:grid md:grid-cols-[1fr_340px] md:items-start md:p-6 lg:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Customer notes are always visible above the menu. */}
            {teacher.notes.map((note) => (
              <NoteBanner key={note}>
                Note for {teacher.name}: {note}
              </NoteBanner>
            ))}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {menu.map((item) => {
                const qty = lines
                  .filter((l) => l.menuItemId === item.id)
                  .reduce((n, l) => n + l.qty, 0);
                return (
                  <div
                    key={item.id}
                    className="flex min-h-[64px] items-center gap-4 rounded-box border border-base-300 bg-base-100 p-3 md:min-h-[110px] md:p-4"
                  >
                    {isMenuIconKey(item.icon) ? (
                      <MenuIcon icon={item.icon} size={44} className="shrink-0 text-primary" />
                    ) : null}
                    <div className="min-w-0 flex-1">
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
                      {isMenuIconKey(addon.icon) ? <MenuIcon icon={addon.icon} size={26} /> : null}
                      {addon.name}
                      {addon.priceCents > 0 ? ` (${formatUSD(addon.priceCents)})` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-3 border-base-300 bg-base-100 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:border-t max-md:p-4 md:sticky md:top-6 md:gap-4 md:rounded-box md:border md:p-6">
            {/* One-line summary below md; the full list shows from md up. */}
            <p className="truncate text-[20px] font-bold md:hidden">
              {lines.length === 0
                ? "Nothing added yet"
                : lines
                    .map((line) => `${line.qty} × ${menuById.get(line.menuItemId)?.name ?? ""}`)
                    .join(", ")}
            </p>
            <ul className="hidden flex-col gap-2 md:flex">
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

            {/* Read aloud each time an item or add-on changes the total. */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="flex items-baseline justify-between gap-4 md:mt-auto md:block md:border-t md:border-base-300 md:pt-4"
            >
              <p className="text-[18px] font-bold opacity-70">Total</p>
              <MoneyDisplay cents={totalCents} size="running" />
            </div>

            <BigButton
              variant="primary"
              disabled={lines.length === 0}
              onClick={() => setStage(cardPaymentsEnabled ? "method" : "pay")}
              className="min-h-[72px]"
            >
              Go to payment
            </BigButton>
          </aside>
        </div>
      </div>
    );
  }

  /* --- Step 3: how the teacher pays (only when staff cards are on) --------- */
  if (stage === "method" && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={3}
          totalSteps={4}
          title="Take payment"
          subtitle={teacher.room ? `${teacher.name} · Room ${teacher.room}` : teacher.name}
          backLabel="Back to the order"
          steps={STEPS}
          onBack={() => setStage("build")}
        />
        {/* DESIGN.md §3: question, Total, two choices. Nothing else. */}
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 p-4 text-center md:p-8">
          <h2 className="text-[44px] font-extrabold leading-tight">How is {teacher.name} paying?</h2>
          <div>
            <p className="text-[18px] font-bold opacity-70">Total</p>
            <MoneyDisplay cents={totalCents} size="total" />
          </div>
          <PaymentChoice
            cardNote={teacher.prefersCard ? "Usually pays by card" : undefined}
            onChoose={(method) => {
              setError(null);
              setStage(method === "cash" ? "pay" : "card");
            }}
          />
        </div>
      </div>
    );
  }

  /* --- Step 3: check the staff card ---------------------------------------- */
  if (stage === "card" && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={3}
          totalSteps={4}
          title="Staff card"
          subtitle={`${teacher.name} owes ${formatUSD(totalCents)}`}
          backLabel="Back to how they pay"
          steps={STEPS}
          onBack={() => setStage("method")}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
          <StaffCardCheck
            teacherName={teacher.name}
            totalCents={totalCents}
            pending={pending}
            error={error}
            onConfirm={() => submit("card")}
          />
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
          backLabel={cardPaymentsEnabled ? "Back to how they pay" : "Back to the order"}
          steps={STEPS}
          onBack={() => setStage(cardPaymentsEnabled ? "method" : "build")}
        />

        {/* DESIGN.md §3: one column below md (owed, change, input, button);
            from md up the input gets its own column. */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:grid md:grid-cols-[1fr_360px] md:grid-rows-[auto_1fr] md:items-start md:p-6 lg:grid-cols-[1fr_420px]">
          <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-1">
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

            {/* Change stays above the keypad so it is visible while counting. */}
            {enough ? <ChangeCard changeCents={receivedCents - totalCents} /> : null}

            {error ? (
              <p role="alert" className="alert alert-warning rounded-box text-[22px] font-extrabold">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1">
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

          <BigButton
            variant="primary"
            disabled={!enough || pending}
            onClick={() => submit("cash")}
            className="md:col-start-1 md:row-start-2"
          >
            {pending ? "Saving…" : "Change given, print receipt"}
          </BigButton>
        </div>
      </div>
    );
  }

  /* --- Step 4: done -------------------------------------------------------- */
  if (stage === "done" && completed && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader step={4} totalSteps={4} title="Order done" steps={STEPS} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center md:p-8">
          <span className="grid size-[150px] place-items-center rounded-full bg-success text-success-content">
            <Check size={80} aria-hidden="true" />
          </span>
          {completed.changeCents === null ? (
            <>
              <h2 className="text-[52px] font-extrabold leading-tight text-success md:text-[68px]">
                Paid by staff card
              </h2>
              <p className="text-[22px] font-bold">
                {teacher.name} paid {formatUSD(completed.totalCents)}
                {" · "}receipt is on its way
              </p>
            </>
          ) : (
            <>
              <h2 className="text-[44px] font-extrabold text-success">Change given</h2>
              <p className="text-[22px] font-bold">
                {teacher.name} paid {formatUSD(completed.totalCents + completed.changeCents)}
                {" · "}change {formatUSD(completed.changeCents)}
                {" · "}receipt is on its way
              </p>
            </>
          )}
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
 * Appends a keypad digit to a cents entry, terminal-style (5, 0, 0 is $5.00).
 * Drops leading zeroes and ignores a digit that would pass the server's limit.
 */
function appendDigit(current: string, digit: string): string {
  const next = (current + digit).replace(/^0+(?=\d)/, "");
  return Number.parseInt(next, 10) > MAX_RECEIVED_CENTS ? current : next;
}
