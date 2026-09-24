/**
 * The shape of the admin side's help.
 *
 * Every help surface (the panel on each page, the guides on admin home, the
 * setup checklist and the tour) reads from one module of these, so the same
 * task is never described two ways. tests/help.test.ts checks the content
 * against the app itself: every admin page has help, every guide it points to
 * exists, every page a guide points to exists.
 */

/** Every page of the admin side, by URL. */
export const ADMIN_ROUTES = [
  "/admin",
  "/admin/students",
  "/admin/teachers",
  "/admin/menu",
  "/admin/orders",
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
  "/admin/orders": "Orders",
  "/admin/receipts": "Receipts",
  "/admin/admins": "Admins",
  "/admin/colors": "Colors",
};

export type GuideTopic =
  | "Getting started"
  | "Students"
  | "Teachers"
  | "Menu"
  | "Orders and receipts"
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
  /** Anything worth knowing that is not a step. */
  note?: string;
  /** The page where the steps happen, offered as a button. */
  page?: AdminRoute;
}

export interface PageHelp {
  /** One or two sentences: what this page is for and when you would come here. */
  purpose: string;
  /** Guide ids for the tasks people come to this page to do, most common first. */
  tasks: string[];
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
}
