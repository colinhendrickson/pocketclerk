/**
 * Design-system primitives (DESIGN.md §4). Screens import from `@/components`
 * only. Client components keep their `"use client"` directive in their own
 * files, so re-exporting them here preserves the boundary.
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
export { DemoBanner } from "./demo-banner";
export { MenuIcon } from "./menu-icon";
export type { MenuIconProps } from "./menu-icon";
export { PaymentChoice } from "./payment-choice";
export type { PaymentChoiceProps, PaymentChoiceMethod } from "./payment-choice";
export { StaffCardCheck } from "./staff-card-check";
export type { StaffCardCheckProps } from "./staff-card-check";
