import type { AdminRoute } from "./types";

/**
 * "Show me around" tours for admin pages. Separate from content.ts because
 * tours run in the browser and content.ts imports server-only rules. Steps
 * target `data-tour` attributes (tests verify they exist); a step whose target
 * is hidden at the current size uses its fallback or is skipped.
 */

export interface TourStep {
  /** `data-tour` value of the target element. */
  target: string;
  title: string;
  body: string;
}

const MENU_STEP: TourStep = {
  target: "nav",
  title: "Getting around",
  body: "Every page of the admin side is in this menu. On a phone, tap the menu button at the top left to open it.",
};

const HELP_STEP: TourStep = {
  target: "help",
  title: "Help on every page",
  body: "Every page starts with this. Open any question to see the steps. Once you know the page, close it; it stays closed on this device.",
};

export const TOURS: Record<AdminRoute, TourStep[]> = {
  "/admin": [
    {
      target: "setup",
      title: "Get the cart ready",
      body: "What the cart still needs before students can use it. Each step ticks itself off when it is done, and says how to do it.",
    },
    {
      target: "today",
      title: "Today at a glance",
      body: "Orders and sales so far today, split into cash and staff card, anyone still clocked in, and any receipts that could not be sent.",
    },
    MENU_STEP,
    {
      target: "guides",
      title: "How do I…",
      body: "Step-by-step answers for everything on the admin side. Search for a word such as PIN or receipt, or open a topic.",
    },
  ],
  "/admin/students": [
    HELP_STEP,
    {
      target: "add-student",
      title: "Adding a student",
      body: "Their name as it should appear at the cart, and a four-digit PIN typed twice. Tell them the PIN in person: it is never shown again.",
    },
    {
      target: "student-table",
      title: "Everyone on the roster",
      body: "Shifts, hours and rewards for each student. Reset PIN is for a forgotten PIN or a lockout; Deactivate is for someone who has left.",
    },
    MENU_STEP,
  ],
  "/admin/teachers": [
    HELP_STEP,
    {
      target: "add-teacher",
      title: "Adding a teacher",
      body: "Their name as students say it, their room, and their school email. Without an email they get no receipts.",
    },
    {
      target: "teacher-table",
      title: "The teacher list",
      body: "Press Details on a teacher to fix their email, mark that they usually pay with a staff card, add a note students will see (such as an allergy), and see what they have bought.",
    },
    MENU_STEP,
  ],
  "/admin/menu": [
    HELP_STEP,
    {
      target: "menu-items",
      title: "Menu items",
      body: "What students can sell. Add an item with its price, mark the special treat, change a price with Edit, or Take off to hide it.",
    },
    {
      target: "add-ons",
      title: "Add-ons",
      body: "Extras a student adds to a drink, such as syrup or milk. Give free extras a price of 0.00.",
    },
    {
      target: "card-payments",
      title: "How teachers pay",
      body: "Cash always works. Turn this on to let teachers pay with their staff ID card instead; students check the card rather than making change.",
    },
    MENU_STEP,
  ],
  "/admin/orders": [
    HELP_STEP,
    {
      target: "day-nav",
      title: "Choosing a day",
      body: "The page opens on today. Move a day at a time, or jump back to today.",
    },
    {
      target: "orders-table",
      title: "Every sale that day",
      body: "When it was, which teacher, which student served it, what was bought, and how it was paid: cash with the change given, or a staff card. The totals above split cash from card.",
    },
    MENU_STEP,
  ],
  "/admin/receipts": [
    HELP_STEP,
    {
      target: "receipts-table",
      title: "Receipt deliveries",
      body: "Whether each receipt reached the teacher. A failed one says why in the Problem column; fix the cause, usually the teacher's email, then press Retry.",
    },
    MENU_STEP,
  ],
  "/admin/admins": [
    HELP_STEP,
    {
      target: "give-access",
      title: "Giving someone access",
      body: "Only the owner can. Enter their name and school email; they sign in with a code sent to that email, so there is no password to pass on.",
    },
    {
      target: "admin-list",
      title: "Who has access",
      body: "Everyone who can use the admin side. The owner is marked, and nobody can remove the owner, so the school is never locked out.",
    },
    MENU_STEP,
  ],
  "/admin/inventory": [
    HELP_STEP,
    {
      target: "add-supply",
      title: "Add a supply",
      body: "Anything the cart uses up, such as cups or lids. Full cart is how many it holds when stocked.",
    },
    {
      target: "supplies",
      title: "Your supplies",
      body: "Students count each of these at the end of a shift. Edit a name or amount, or Take off something the cart no longer carries.",
    },
    MENU_STEP,
  ],
  "/admin/colors": [
    HELP_STEP,
    {
      target: "color-presets",
      title: "Ready-made colors",
      body: "Blues chosen to be easy to read. Tap one to see it in the preview.",
    },
    {
      target: "color-exact",
      title: "The school's exact color",
      body: "Choose it with the color picker, or type its code, which starts with #.",
    },
    {
      target: "color-preview",
      title: "Preview",
      body: "How buttons and highlights will look. The line underneath says whether text stays easy to read, and offers a darker shade if not.",
    },
    {
      target: "color-save",
      title: "Saving",
      body: "Nothing changes until you press Save color. Then every page does, including the cart. You can always go back to the original teal.",
    },
    MENU_STEP,
  ],
};
