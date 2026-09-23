/**
 * The PocketClerk primitive set — the components named in the DESIGN.md §4 map.
 *
 * Screens import from `@/components` and nowhere else in this directory, so the
 * design system has exactly one front door and a reviewer can tell from an
 * import line whether a screen is built from sanctioned primitives or from
 * hand-rolled markup.
 *
 * Client entry points (`big-button`, `keypad`) re-export cleanly through this
 * barrel: the `"use client"` directive lives in the source file, so a server
 * component importing them from here still gets the right boundary.
 *
 * Not yet built: PaymentChoice, BadgeModal, and the admin shell.
 */

export { BigButton } from "./big-button";
export type {
  BigButtonProps,
  BigButtonVariant,
  BigButtonLayout,
} from "./big-button";

export { MoneyDisplay } from "./money-display";
export type { MoneyDisplayProps, MoneySize } from "./money-display";

export { NoteBanner } from "./note-banner";
export type { NoteBannerProps } from "./note-banner";

export { StepHeader } from "./step-header";
export type { StepHeaderProps } from "./step-header";

export { ChangeCard } from "./change-card";
export type { ChangeCardProps } from "./change-card";

export { Keypad, BillButtons } from "./keypad";
export type { KeypadProps, BillButtonsProps } from "./keypad";

export { ShiftStats } from "./shift-stats";
export type { ShiftStatsProps, ShiftStat } from "./shift-stats";

export { TeacherCard } from "./teacher-card";
export type { TeacherCardProps } from "./teacher-card";
export { RouteFocus, SkipLink } from "./page-focus";
export { Logo } from "./logo";
export type { LogoProps } from "./logo";
