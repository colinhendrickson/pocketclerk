"use client";

/**
 * TeacherCard — one pickable teacher in the classroom-order flow.
 *
 * Implements the TeacherCard row of the DESIGN.md §4 map: `card card-border`
 * with an `avatar avatar-placeholder` initials disc at 56px (inside the 52–60px
 * band), the name at 26px, and the room on the line below.
 *
 * Initials stand in for photographs on purpose. The cart has no photo library
 * and school data stays out of the repo, so a two-letter disc is the only
 * identifier that is recognisable at arm's length without storing anything
 * about a real person in code or seed data.
 *
 * The whole card is a 60px+ tap target and stays a server component: selection
 * is a `Link` into the next step of the flow, not local state. Rendered without
 * `href` it is a static summary — the same card, reused in the order builder to
 * show who the order is for.
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface TeacherCardProps {
  /** Display name, rendered verbatim. */
  name: string;
  /** Room or location line under the name. */
  room?: string;
  /** Overrides the derived two-letter disc. */
  initials?: string;
  /** Optional Lucide glyph on the trailing edge, e.g. a chevron or a check. */
  icon?: LucideIcon;
  /** Makes the card a tap target that navigates. Omit for a static summary. */
  href?: string;
  /**
   * Selection handler for flows that keep their state in the client rather than
   * in the URL. Ignored when `href` is given.
   */
  onSelect?: () => void;
  /**
   * Number of saved notes about this teacher. Surfaced on the card so a student
   * knows before tapping that there is something to read.
   */
  noteCount?: number;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function TeacherCard({
  name,
  room,
  initials,
  icon: Icon,
  href,
  onSelect,
  noteCount = 0,
}: TeacherCardProps) {
  const body = (
    <div className="card-body flex-row items-center gap-4 min-h-[60px] py-4">
      <div className="avatar avatar-placeholder">
        <div className="bg-neutral text-neutral-content w-14 rounded-full">
          <span className="text-[22px] font-extrabold">
            {initials ?? deriveInitials(name)}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[26px] font-extrabold truncate">{name}</p>
        {room ? (
          <p className="text-[18px] font-bold opacity-70 truncate">{room}</p>
        ) : null}
      </div>

      {noteCount > 0 ? (
        <span className="badge badge-warning ml-auto shrink-0 text-[16px] font-extrabold">
          {noteCount} {noteCount === 1 ? "note" : "notes"}
        </span>
      ) : null}

      {Icon ? (
        <Icon size={34} aria-hidden="true" className="ml-auto shrink-0" />
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card card-border bg-base-100 text-left">
        {body}
      </Link>
    );
  }

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="card card-border bg-base-100 text-left w-full"
      >
        {body}
      </button>
    );
  }

  return <div className="card card-border bg-base-100">{body}</div>;
}
