"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

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
import { addOne, countRepeats, removeOne } from "@/lib/addons";
import { isMenuIconKey } from "@/lib/menu-icons";
import { formatUSD, orderTotalCents } from "@/lib/money";
import type { TeacherSummary } from "@/lib/queries";
import { MAX_ADDONS_PER_LINE, MAX_RECEIVED_CENTS } from "@/lib/validate";

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

/** One menu item in the order, with the add-ons chosen for it. A repeated id is another one: two sugars. */
interface Line {
  menuItemId: string;
  qty: number;
  addonIds: string[];
}

/**
 * `addons` picks the extras for the drink just added; `method` asks how the
 * teacher pays; `pay` makes change; `card` checks a staff card.
 */
type Stage = "teacher" | "build" | "addons" | "method" | "pay" | "card" | "done";

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
  // The line whose add-ons are on screen, while stage is "addons".
  const [editing, setEditing] = useState<number | null>(null);
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

  const paymentStage: Stage = cardPaymentsEnabled ? "method" : "pay";

  /**
   * With add-ons on the menu, each drink gets its own line and opens the
   * Add-ons page, so two sugars in the coffee and none in the tea stay apart.
   */
  function addItem(menuItemId: string) {
    if (addons.length > 0) {
      setEditing(lines.length);
      setLines([...lines, { menuItemId, qty: 1, addonIds: [] }]);
      setStage("addons");
      return;
    }
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

  /** Takes one away from the most recent line of this item. */
  function removeItem(menuItemId: string) {
    setLines((current) => {
      let at = -1;
      current.forEach((l, i) => {
        if (l.menuItemId === menuItemId) at = i;
      });
      if (at === -1) return current;
      return current
        .map((l, i) => (i === at ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0);
    });
  }

  /** One more, or one fewer, of an add-on on the drink being edited. */
  function changeAddon(addonId: string, change: "add" | "remove") {
    if (editing === null) return;
    setLines((current) =>
      current.map((line, i) =>
        i !== editing
          ? line
          : {
              ...line,
              addonIds:
                change === "add"
                  ? addOne(line.addonIds, addonId, MAX_ADDONS_PER_LINE)
                  : removeOne(line.addonIds, addonId),
            },
      ),
    );
  }

  /** Leaves the Add-ons page. A drink with none rejoins an earlier plain one: 2 × Coffee, not two lines. */
  function finishAddons(next: Stage) {
    const at = editing;
    setLines((current) => {
      const line = at === null ? undefined : current[at];
      if (!line || line.addonIds.length > 0) return current;
      const twin = current.findIndex(
        (l, i) => i !== at && l.menuItemId === line.menuItemId && l.addonIds.length === 0,
      );
      if (twin === -1) return current;
      return current
        .map((l, i) => (i === twin ? { ...l, qty: l.qty + line.qty } : l))
        .filter((_, i) => i !== at);
    });
    setEditing(null);
    setStage(next);
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
    setEditing(null);
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

  const subtitle = teacher
    ? teacher.room
      ? `${teacher.name} · Room ${teacher.room}`
      : teacher.name
    : undefined;

  /** Customer notes are always visible above the menu and the add-ons. */
  const notes = teacher
    ? teacher.notes.map((note) => (
        <NoteBanner key={note}>
          Note for {teacher.name}: {note}
        </NoteBanner>
      ))
    : null;

  /** Read aloud each time an item or add-on changes the total. */
  const total = (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="flex items-baseline justify-between gap-4 md:mt-auto md:block md:border-t md:border-base-300 md:pt-4"
    >
      <p className="text-[18px] font-bold opacity-70">Total</p>
      <MoneyDisplay cents={totalCents} size="running" />
    </div>
  );

  /* --- Step 2: build the order -------------------------------------------- */
  if (stage === "build" && teacher) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={2}
          totalSteps={4}
          title="Build the order"
          subtitle={subtitle}
          backLabel="Back to teachers"
          steps={STEPS}
          onBack={() => setStage("teacher")}
        />

        {/* Bottom padding clears the fixed order sheet below md. */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pb-[260px] md:grid md:grid-cols-[1fr_340px] md:items-start md:p-6 lg:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            {notes}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {menu.map((item) => (
                <CountRow
                  key={item.id}
                  name={item.name}
                  icon={item.icon}
                  price={formatUSD(item.priceCents)}
                  detail={
                    item.isSpecial ? (
                      <p className="text-[15px] font-bold text-accent">Special treat</p>
                    ) : null
                  }
                  count={lines
                    .filter((l) => l.menuItemId === item.id)
                    .reduce((n, l) => n + l.qty, 0)}
                  onAdd={() => addItem(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </div>

          <aside className={SHEET_CLASS}>
            {/* One-line summary below md; the full list shows from md up. */}
            <p className="truncate text-[20px] font-bold md:hidden">
              {lines.length === 0
                ? "Nothing added yet"
                : lines
                    .map((line) => `${line.qty} × ${menuById.get(line.menuItemId)?.name ?? ""}`)
                    .join(", ")}
            </p>
            <OrderLines lines={lines} menuById={menuById} addonById={addonById} />

            {total}

            <BigButton
              variant="primary"
              disabled={lines.length === 0}
              onClick={() => setStage(paymentStage)}
              className="min-h-[72px]"
            >
              Go to payment
            </BigButton>
          </aside>
        </div>
      </div>
    );
  }

  /* --- Step 2: add-ons for the drink just added ---------------------------- */
  const editingLine = editing === null ? undefined : lines[editing];
  if (stage === "addons" && teacher && editingLine) {
    const item = menuById.get(editingLine.menuItemId);
    const full = editingLine.addonIds.length >= MAX_ADDONS_PER_LINE;
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader
          step={2}
          totalSteps={4}
          title={`Add-ons for the ${item?.name ?? "drink"}`}
          subtitle={subtitle}
          backLabel="Back to the order"
          steps={STEPS}
          onBack={() => finishAddons("build")}
        />

        {/* The sheet below md holds two buttons here, so it needs more room. */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 pb-[340px] md:grid md:grid-cols-[1fr_340px] md:items-start md:p-6 lg:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            {notes}

            <p className="text-[20px] font-bold">
              Press + once for each one. Two sugars is + two times.
            </p>

            {/* One column until xl: names like Sweetener need the room beside − 2 +. */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {addons.map((addon) => (
                <CountRow
                  key={addon.id}
                  name={addon.name}
                  icon={addon.icon}
                  price={addon.priceCents > 0 ? `${formatUSD(addon.priceCents)} each` : "Free"}
                  count={editingLine.addonIds.filter((id) => id === addon.id).length}
                  addDisabled={full}
                  onAdd={() => changeAddon(addon.id, "add")}
                  onRemove={() => changeAddon(addon.id, "remove")}
                />
              ))}
            </div>

            {full ? (
              <p role="status" className="text-[20px] font-bold">
                That is as many add-ons as one drink can have.
              </p>
            ) : null}
          </div>

          <aside className={SHEET_CLASS}>
            {/* Below md: just this drink and its add-ons. */}
            <p className="truncate text-[20px] font-bold md:hidden">
              {item?.name ?? ""}
              {editingLine.addonIds.length === 0
                ? ", no add-ons yet"
                : `, ${countRepeats(editingLine.addonIds)
                    .map(({ id, count }) => `${count} ${addonById.get(id)?.name ?? ""}`)
                    .join(", ")}`}
            </p>
            <OrderLines lines={lines} menuById={menuById} addonById={addonById} />

            {total}

            <BigButton onClick={() => finishAddons("build")}>Add another item</BigButton>
            <BigButton
              variant="primary"
              onClick={() => finishAddons(paymentStage)}
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
          subtitle={subtitle}
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

/** The order sheet: below md a fixed bottom bar, from md up a sticky side panel. */
const SHEET_CLASS =
  "flex flex-col gap-3 border-base-300 bg-base-100 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:border-t max-md:p-4 md:sticky md:top-6 md:gap-4 md:rounded-box md:border md:p-6";

interface CountRowProps {
  name: string;
  icon: string | null;
  /** Shown under the name, e.g. "$1.00" or "Free". */
  price: string;
  detail?: ReactNode;
  count: number;
  addDisabled?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

/** A menu item or add-on: picture, name, price, and − count + to change how many. */
function CountRow({ name, icon, price, detail, count, addDisabled, onAdd, onRemove }: CountRowProps) {
  return (
    <div className="flex min-h-[64px] items-center gap-4 rounded-box border border-base-300 bg-base-100 p-3 md:min-h-[110px] md:p-4">
      {isMenuIconKey(icon) ? (
        <MenuIcon icon={icon} size={44} className="shrink-0 text-primary" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[26px] font-extrabold">{name}</p>
        {detail}
        <p className="text-[20px] font-bold tabular">{price}</p>
      </div>
      <div className="flex items-center gap-2">
        {count > 0 ? (
          <>
            <button
              type="button"
              aria-label={`Remove one ${name}`}
              onClick={onRemove}
              className="btn size-[60px] rounded-field bg-base-200"
            >
              <Minus size={28} aria-hidden="true" />
            </button>
            <span className="min-w-[2ch] text-center text-[26px] font-extrabold tabular">
              {count}
            </span>
          </>
        ) : null}
        <button
          type="button"
          aria-label={`Add one ${name}`}
          disabled={addDisabled}
          onClick={onAdd}
          className="btn btn-primary size-[60px] rounded-field"
        >
          <Plus size={28} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface OrderLinesProps {
  lines: Line[];
  menuById: Map<string, MenuItem>;
  addonById: Map<string, Addon>;
}

/**
 * Each drink with its add-ons underneath, a repeat shown once with its count
 * ("2 × Sugar"). Hidden below md, where the sheet has room for one line only.
 */
function OrderLines({ lines, menuById, addonById }: OrderLinesProps) {
  return (
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
              <span className="tabular">{formatUSD(item.priceCents * line.qty)}</span>
            </span>
            {countRepeats(line.addonIds).map(({ id, count }) => {
              const addon = addonById.get(id);
              if (!addon) return null;
              return (
                <span
                  key={id}
                  className="flex justify-between pl-4 text-[18px] font-bold opacity-80"
                >
                  <span>
                    {count > 1 ? `${count} × ` : ""}
                    {addon.name}
                  </span>
                  <span className="tabular">
                    {formatUSD(addon.priceCents * count * line.qty)}
                  </span>
                </span>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
