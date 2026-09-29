/**
 * Types for admin help. Every help surface reads from one module so a task is
 * described once; tests/help.test.ts checks cross-references against the app.
 */

/** Every page of the admin side, by URL. */
export const ADMIN_ROUTES = [
  "/admin",
  "/admin/students",
  "/admin/teachers",
  "/admin/menu",
  "/admin/inventory",
  "/admin/orders",
  "/admin/expenses",
  "/admin/receipts",
  "/admin/admins",
  "/admin/colors",
] as const;

export type AdminRoute = (typeof ADMIN_ROUTES)[number];

/** Each page as it is named in the menu. */
export const PAGE_NAMES: Record<AdminRoute, string> = {
  "/admin": "Admin home",
  "/admin/students": "Students",
  "/admin/teachers": "Teachers",
  "/admin/menu": "Menu",
  "/admin/inventory": "Inventory",
  "/admin/orders": "Orders",
  "/admin/expenses": "Expenses",
  "/admin/receipts": "Receipts",
  "/admin/admins": "Admins",
  "/admin/colors": "Colors",
};

export type GuideTopic =
  | "Getting started"
  | "Students"
  | "Teachers"
  | "Menu"
  | "Inventory"
  | "Orders and receipts"
  | "Expenses"
  | "Access and signing in"
  | "Colors";

export interface Guide {
  /** Stable, used as the anchor id. Lower-case with dashes. */
  id: string;
  topic: GuideTopic;
  /** Phrased as the question staff would ask: "A student forgot their PIN". */
  title: string;
  /** Numbered steps, each one action, naming buttons exactly as they appear. */
  steps: string[];
  note?: string;
  /** The page where the steps happen, offered as a button. */
  page?: AdminRoute;
  /** External link the steps need, such as an App Store page. */
  link?: ExternalLink;
}

export interface ExternalLink {
  label: string;
  /** Always https. */
  href: string;
}

export interface PageHelp {
  /** One or two sentences on what the page is for. */
  purpose: string;
  /** Guide ids for this page's tasks, most common first. */
  tasks: string[];
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
}
