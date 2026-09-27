"use client";

/**
 * TeacherCard: a teacher in the classroom-order flow (DESIGN.md §4). Uses an
 * initials disc instead of a photo so no personal images are stored. Renders
 * as a link (`href`), a button (`onSelect`), or a static summary (neither).
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface TeacherCardProps {
  name: string;
  /** Room or location line under the name. */
  room?: string;
  /** Overrides the derived two-letter disc. */
  initials?: string;
  /** Trailing glyph, e.g. a chevron or a check. */
  icon?: LucideIcon;
  href?: string;
  /** For flows whose state lives in the client. Ignored when `href` is set. */
  onSelect?: () => void;
  /** Saved notes about this teacher, shown as a badge. */
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
