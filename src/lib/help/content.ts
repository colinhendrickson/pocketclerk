import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/auth";
import { TOKEN_MINUTES } from "@/lib/admin-auth";
import { branding } from "@/lib/branding";
import { MAX_ATTEMPTS } from "@/lib/receipt-jobs";

import type { AdminRoute, GlossaryEntry, Guide, GuideTopic, PageHelp } from "./types";

/**
 * Everything the admin side says to explain itself.
 *
 * Written for someone who opens this a few times a term and has never been
 * shown it: plain words, one action per step, buttons named exactly as they
 * appear on screen. Numbers that are rules elsewhere in the code (the PIN
 * lockout, how long a sign-in code lasts) are imported, not retyped, so the
 * help cannot drift from what the app does.
 */

const reward = branding.rewardName;
const rewardLower = reward.toLowerCase();
const cart = branding.cartName;

export const TOPICS: GuideTopic[] = [
  "Getting started",
  "Students",
  "Teachers",
  "Menu",
  "Orders and receipts",
  "Access and signing in",
  "Colors",
];

export const GUIDES: Guide[] = [
  /* Getting started ------------------------------------------------------ */
  {
    id: "what-is-this",
    topic: "Getting started",
    title: "What this admin side is for",
    steps: [
      `Students run ${cart} on the cart's iPad: they clock in with a PIN, take orders, count change and count the stock.`,
      "Everything they do is saved here. This admin side is where staff set the cart up and look after it.",
      "Students: who can sign in at the cart, their PINs, and their hours.",
      "Teachers: the customers. Their rooms, their emails for receipts, and notes students should see.",
      "Menu: what can be ordered and what it costs.",
      "Orders and Receipts: what was sold each day, and whether each teacher's receipt arrived.",
      "Admins: which staff can use this admin side.",
    ],
    note: "Nothing here can break a sale in progress. Changes take effect on the cart the next time a student taps.",
  },
  {
    id: "first-setup",
    topic: "Getting started",
    title: "Setting up the cart for the first time",
    steps: [
      "Open Admin home. The setup checklist at the top shows what is done and what is left.",
      "Add your students, each with a four-digit PIN they will remember.",
      "Add your teachers, with their school emails so they get receipts.",
      "Set up the menu: each item and its price, and any add-ons such as milk or syrup.",
      "Connect the cart's iPad using the link in the checklist.",
      "Have a student clock in and sell one item to check everything works.",
    ],
    note: "Each checklist step ticks itself off when it is done. You do not need to do them in one sitting.",
    page: "/admin",
  },
  {
    id: "pair-ipad",
    topic: "Getting started",
    title: "Connecting the cart's iPad",
    steps: [
      "On Admin home, find “Connect the cart's iPad” in the setup checklist.",
      "Open that link on the iPad itself. The easiest way is to email it to yourself and tap it in the email on the iPad.",
      "The iPad shows the list of students. It is connected, and stays connected.",
      "The checklist step ticks off the first time a student clocks in on it.",
      "To connect another device later, such as a computer to try the cart on, open “Connect another device” on that same step.",
    ],
    note: "Only a connected iPad can show the student list or take orders. Anyone opening the site on another device sees a “not set up” page instead, which keeps the students' names private.",
    page: "/admin",
  },

  /* Students ------------------------------------------------------------- */
  {
    id: "add-student",
    topic: "Students",
    title: "Adding a student",
    steps: [
      "Open Students.",
      "Under “Add a student”, type their name the way it should appear on the cart.",
      "Choose a four-digit PIN, and type it again in Repeat PIN.",
      "Press Add student. They appear at the cart straight away.",
    ],
    note: "Tell the student their PIN in person. It is never shown again here; if it is forgotten, set a new one.",
    page: "/admin/students",
  },
  {
    id: "forgot-pin",
    topic: "Students",
    title: "A student forgot their PIN or is locked out",
    steps: [
      "Open Students and find the student.",
      "Press Reset PIN.",
      "Type a new four-digit PIN and press Save PIN.",
      "Tell the student the new PIN. They can sign in immediately.",
    ],
    note: `After ${MAX_FAILED_ATTEMPTS} wrong PINs in a row the cart locks that student out for ${LOCKOUT_MINUTES} minutes, so nobody can guess a PIN. Resetting the PIN also ends the lockout.`,
    page: "/admin/students",
  },
  {
    id: "student-leaves",
    topic: "Students",
    title: "A student has left the program",
    steps: [
      "Open Students and find the student.",
      "Press Deactivate. They disappear from the cart's sign-in list.",
      "If they come back, press Reactivate. Their PIN and history are as they were.",
    ],
    note: "Nothing is ever deleted. Their shifts and the sales they made stay in the records.",
    page: "/admin/students",
  },
  {
    id: "hours-rewards",
    topic: "Students",
    title: `Checking a student's hours and ${rewardLower}`,
    steps: [
      "Open Students.",
      `Each row shows the student's total shifts, total hours and total ${rewardLower}.`,
    ],
    note: `A student earns one of the ${rewardLower} for each whole hour of a shift, counted when they clock out. A 90-minute shift earns one; a partial hour earns nothing.`,
    page: "/admin/students",
  },

  /* Teachers ------------------------------------------------------------- */
  {
    id: "add-teacher",
    topic: "Teachers",
    title: "Adding a teacher",
    steps: [
      "Open Teachers.",
      "Under “Add a teacher”, type their name as students say it, such as Mrs. Lopez.",
      "Add their room, and their school email if you have it.",
      "Press Add teacher.",
    ],
    note: "Students can also add a teacher at the cart during an order. Check the list now and then for spelling, and add the email if it is missing.",
    page: "/admin/teachers",
  },
  {
    id: "teacher-email",
    topic: "Teachers",
    title: "A teacher is not getting receipts",
    steps: [
      "Open Teachers and find the teacher. Press Details.",
      "Check the Email. If it is blank or misspelled, correct it.",
      "Press Save details. Their next order will be emailed.",
      "To see what happened to earlier receipts, open Receipts.",
    ],
    note: "A teacher with no email is served as normal but gets no emailed receipt. Receipts already sent to a wrong address are not sent again.",
    page: "/admin/teachers",
  },
  {
    id: "teacher-note",
    topic: "Teachers",
    title: "Adding a note students will see, such as an allergy",
    steps: [
      "Open Teachers, find the teacher and press Details.",
      "Under Notes, type the note, for example “Oat milk only”.",
      "Press Add note.",
    ],
    note: "When a student picks this teacher at the cart, every note appears in an orange banner above the menu, and cannot be hidden. To remove a note, press Remove beside it.",
    page: "/admin/teachers",
  },
  {
    id: "teacher-leaves",
    topic: "Teachers",
    title: "A teacher has left the school",
    steps: [
      "Open Teachers, find the teacher and press Deactivate.",
      "They no longer appear at the cart. Press Reactivate to bring them back.",
    ],
    note: "Their past orders stay in the records.",
    page: "/admin/teachers",
  },

  /* Menu ----------------------------------------------------------------- */
  {
    id: "add-menu-item",
    topic: "Menu",
    title: "Adding something to the menu",
    steps: [
      "Open Menu.",
      "Under Menu items, type the name and the price in dollars, such as 1.50.",
      "Tick Special if it is this week's special treat.",
      "Press Add item. It appears at the cart straight away.",
    ],
    page: "/admin/menu",
  },
  {
    id: "change-price",
    topic: "Menu",
    title: "Changing a price",
    steps: [
      "Open Menu and find the item.",
      "Press Edit, change the price, and press Save.",
    ],
    note: "The new price applies from the next sale. Orders already taken keep the price that was charged, so past receipts and totals never change.",
    page: "/admin/menu",
  },
  {
    id: "set-special",
    topic: "Menu",
    title: "Setting the special treat",
    steps: [
      "Open Menu and find the item.",
      "Press Mark special. It shows as “Special treat” at the cart.",
      "To end the special, press Special on that item again.",
    ],
    note: "More than one item can be special at a time.",
    page: "/admin/menu",
  },
  {
    id: "add-ons",
    topic: "Menu",
    title: "Add-ons and free extras",
    steps: [
      "Open Menu and go to Add-ons.",
      "Type the name, such as Vanilla syrup, and the price. For a free extra such as sugar, enter 0.00.",
      "Press Add add-on.",
    ],
    note: "At the cart, a student adds an add-on to the drink they just added. Free extras are listed for the student but do not change the total.",
    page: "/admin/menu",
  },
  {
    id: "take-off-menu",
    topic: "Menu",
    title: "Taking something off the menu",
    steps: [
      "Open Menu and find the item or add-on.",
      "Press Take off. It disappears from the cart.",
      "Press Put back to offer it again.",
    ],
    note: "Nothing is deleted, so past orders that included it are unaffected.",
    page: "/admin/menu",
  },

  /* Orders and receipts -------------------------------------------------- */
  {
    id: "day-sales",
    topic: "Orders and receipts",
    title: "Seeing what was sold on a day",
    steps: [
      "Open Orders. It shows today.",
      "Press Previous day or Next day to move, or Today to come back.",
      "The top shows the number of orders and the total sales; the list shows each order, who served it, what was bought and the change given.",
    ],
    page: "/admin/orders",
  },
  {
    id: "missing-receipt",
    topic: "Orders and receipts",
    title: "A teacher says they did not get a receipt",
    steps: [
      "Open Receipts and look for their order.",
      "If it says sent, it was delivered: ask them to check their junk or spam folder.",
      "If it says failed, read the Problem column. It is usually a missing or mistyped email.",
      "Fix the email on the Teachers page, then come back and press Retry.",
      "If the teacher has no email and does not want one, press Dismiss.",
    ],
    note: "If there is no receipt listed for the order at all, the teacher had no email when they bought. Add one for next time.",
    page: "/admin/receipts",
  },
  {
    id: "receipt-statuses",
    topic: "Orders and receipts",
    title: "What each receipt status means",
    steps: [
      "Queued: waiting to be sent, usually for a few seconds.",
      "Processing: being sent right now.",
      "Sent: delivered to the teacher's email.",
      `Failed: tried ${MAX_ATTEMPTS} times without success. The Problem column says why.`,
    ],
    note: "A failed receipt never affects the sale. The order is saved the moment it is taken; the receipt is sent afterwards.",
    page: "/admin/receipts",
  },
  {
    id: "retry-receipts",
    topic: "Orders and receipts",
    title: "Resending failed receipts",
    steps: [
      "Fix the cause first, usually the teacher's email on the Teachers page.",
      "Open Receipts.",
      "Press Retry on one receipt, or Retry all to resend every failed one.",
      "Press Dismiss on any receipt you want to give up on. The order itself is kept.",
    ],
    page: "/admin/receipts",
  },

  /* Access and signing in ------------------------------------------------ */
  {
    id: "sign-in",
    topic: "Access and signing in",
    title: "Signing in",
    steps: [
      "Go to the admin sign-in page and type your school email.",
      "Press Email me a sign-in code.",
      "Open the email and type the six-digit code into the sign-in page.",
      "Or, on a computer where your email is open, open the link in the email and press the button on the page it opens.",
    ],
    note: `There is no password. Codes last ${TOKEN_MINUTES} minutes and work once. If no email comes, check junk or spam, and check that this email has been given access on the Admins page.`,
  },
  {
    id: "shared-device",
    topic: "Access and signing in",
    title: "Staying signed in, and signing out on a shared device",
    steps: [
      "On your own phone or computer you stay signed in for 30 days.",
      "On a shared device, such as the cart's iPad, open the menu and press Sign out when you finish.",
    ],
    note: "Signing out takes effect immediately.",
  },
  {
    id: "give-access",
    topic: "Access and signing in",
    title: "Giving another member of staff access",
    steps: [
      "Open Admins.",
      "Type their name and school email, then press Give access.",
      "Tell them to go to the sign-in page and enter that email. A code will be emailed to them.",
    ],
    note: "They get the same access you have. If they already have a teacher entry with that email, it is the same person: their orders stay together.",
    page: "/admin/admins",
  },
  {
    id: "remove-access",
    topic: "Access and signing in",
    title: "Removing someone's access",
    steps: [
      "Open Admins and find them.",
      "Press Remove access, then Yes, remove.",
    ],
    note: "It takes effect on their next click. You cannot remove your own access, and the last admin cannot be removed, so the school can never be locked out.",
    page: "/admin/admins",
  },

  /* Colors --------------------------------------------------------------- */
  {
    id: "change-colors",
    topic: "Colors",
    title: "Changing the color to the school's",
    steps: [
      "Open Colors.",
      "Pick one of the ready-made blues, or match the school's color exactly with the color picker or its code, such as #1d4ed8.",
      "Check the preview and the line under it. If it says the color is too light, press the button to use a darker shade that reads well.",
      "Press Save color. Every page, including the cart, changes straight away.",
    ],
    note: "Only buttons and highlights change; the background stays cream. Colors too light to read are refused, because the students need to read every button. The small icon in the browser tab stays teal.",
    page: "/admin/colors",
  },
  {
    id: "reset-colors",
    topic: "Colors",
    title: "Going back to the original color",
    steps: ["Open Colors.", "Press Back to the original teal."],
    page: "/admin/colors",
  },
];


export const PAGE_HELP: Record<AdminRoute, PageHelp> = {
  "/admin": {
    purpose:
      "The starting point. It shows what the cart still needs, anything that needs your attention, today's sales, and every guide.",
    tasks: ["first-setup", "what-is-this", "pair-ipad"],
  },
  "/admin/students": {
    purpose:
      "Everyone who can sign in at the cart. Add students, reset a forgotten PIN, and see each student's hours.",
    tasks: ["add-student", "forgot-pin", "student-leaves", "hours-rewards"],
  },
  "/admin/teachers": {
    purpose:
      "The cart's customers. Keep emails right so receipts arrive, and add notes students should see when they serve that teacher.",
    tasks: ["add-teacher", "teacher-email", "teacher-note", "teacher-leaves"],
  },
  "/admin/menu": {
    purpose:
      "What students can sell and what it costs. Changes appear at the cart straight away and never alter past orders.",
    tasks: ["add-menu-item", "change-price", "set-special", "add-ons", "take-off-menu"],
  },
  "/admin/orders": {
    purpose: "Every sale, one day at a time: who served it, what was bought, and the change given.",
    tasks: ["day-sales"],
  },
  "/admin/receipts": {
    purpose:
      "Whether each teacher's receipt was delivered. Come here when a teacher says they did not get one, or when Admin home says some failed.",
    tasks: ["missing-receipt", "receipt-statuses", "retry-receipts"],
  },
  "/admin/admins": {
    purpose: "Which staff can use this admin side. Give access to a colleague, or remove it.",
    tasks: ["give-access", "remove-access", "sign-in", "shared-device"],
  },
  "/admin/colors": {
    purpose:
      "The main color of buttons and highlights on every page, including the cart. Set it to the school's.",
    tasks: ["change-colors", "reset-colors"],
  },
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Shift",
    meaning: "The time from when a student clocks in with their PIN to when they clock out.",
  },
  {
    term: reward,
    meaning: `The reward students earn: one for each whole hour of a shift.`,
  },
  {
    term: "Special",
    meaning: "A menu item marked as this week's special treat. The cart points it out to students.",
  },
  {
    term: "Add-on",
    meaning: "An extra added to a drink, such as syrup or milk. Free ones are priced 0.00.",
  },
  {
    term: "Receipt",
    meaning:
      "The email a teacher gets after buying. Sent just after the sale, so a problem with it never holds up the cart.",
  },
  {
    term: "Connected iPad",
    meaning:
      "The cart's iPad, after it has been connected with the link on Admin home. Only a connected device can show students or take orders.",
  },
  {
    term: "Deactivate",
    meaning:
      "Hide a student or teacher from the cart without deleting them. Reactivate brings them back. Menu items do the same with Take off and Put back.",
  },
];

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((guide) => guide.id === id);
}

/**
 * The words for each setup checklist step. Whether a step is done comes from
 * the data (src/lib/setup.ts); what it asks and why lives here with the rest
 * of the help.
 */
export const SETUP_STEP_TEXT: Record<
  "students" | "teachers" | "menu" | "ipad" | "first-sale" | "admins",
  { title: string; why: string; action?: { label: string; href: AdminRoute }; guide: string }
> = {
  students: {
    title: "Add your students",
    why: "Each student signs in at the cart with their own four-digit PIN.",
    action: { label: "Go to Students", href: "/admin/students" },
    guide: "add-student",
  },
  teachers: {
    title: "Add your teachers, with their emails",
    why: "Students tap a teacher's name when they take an order. The email is where that teacher's receipt goes.",
    action: { label: "Go to Teachers", href: "/admin/teachers" },
    guide: "add-teacher",
  },
  menu: {
    title: "Set up the menu",
    why: "What students can sell, at what price. Add-ons such as milk or syrup are set up here too.",
    action: { label: "Go to Menu", href: "/admin/menu" },
    guide: "add-menu-item",
  },
  ipad: {
    title: "Connect the cart's iPad",
    why: "Only a connected device can show the students and take orders. Open the link below on the iPad itself; it only needs doing once.",
    guide: "pair-ipad",
  },
  "first-sale": {
    title: "Try a first sale",
    why: "Have a student clock in on the iPad and sell one item. It proves everything is connected, and the receipt should arrive in the teacher's inbox.",
    guide: "day-sales",
  },
  admins: {
    title: "Give another member of staff access (optional)",
    why: "So someone else can look after the cart when you are away.",
    action: { label: "Go to Admins", href: "/admin/admins" },
    guide: "give-access",
  },
};
