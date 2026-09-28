"use client";

/**
 * PaymentChoice: the two equal tiles on the "How is ... paying?" screen
 * (DESIGN.md §3, §4). Always exactly two, so the component renders the pair
 * rather than one tile. Neither is `btn-primary`: the student must choose, and
 * a highlighted default would choose for them.
 */

import { Banknote, IdCard, type LucideIcon } from "lucide-react";

export type PaymentChoiceMethod = "cash" | "card";

export interface PaymentChoiceProps {
  onChoose: (method: PaymentChoiceMethod) => void;
  /** Optional hint on the staff card tile, e.g. "Usually pays by card". */
  cardNote?: string;
  disabled?: boolean;
}

export function PaymentChoice({ onChoose, cardNote, disabled }: PaymentChoiceProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <Tile
        icon={Banknote}
        iconClass="text-success"
        label="Cash"
        onClick={() => onChoose("cash")}
        disabled={disabled}
      />
      <Tile
        icon={IdCard}
        iconClass="text-info"
        label="Staff card"
        note={cardNote}
        onClick={() => onChoose("card")}
        disabled={disabled}
      />
    </div>
  );
}

interface TileProps {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  note?: string;
  onClick: () => void;
  disabled?: boolean;
}

// Below md the tiles stack full width, so the icon sits beside the label to fit 160px.
function Tile({ icon: Icon, iconClass, label, note, onClick, disabled }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn h-[160px] w-full flex-row justify-start gap-6 rounded-box border-2 border-base-300 bg-base-100 px-6 md:h-[250px] md:flex-col md:justify-center md:gap-3"
    >
      <Icon aria-hidden="true" className={`size-[80px] shrink-0 ${iconClass}`} />
      <span className="flex flex-col items-start gap-1 md:items-center">
        <span className="text-[40px] font-extrabold leading-tight">{label}</span>
        {note ? <span className="text-[18px] font-bold opacity-70">{note}</span> : null}
      </span>
    </button>
  );
}
