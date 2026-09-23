# Admin guidance and accessibility — design

Date: 2026-09-23 · Status: built, all five stages shipped

## Why

Several staff share the admin side equally, and some open it only a few times a
term. Every question they cannot answer from the app lands on the developer.
The admin side must explain itself: what each page is for, how to do each common
task, and what the cart still needs before it can run. The whole app must also
meet WCAG 2.2 AA, because the students using the cart are in a special-education
program and the staff using the admin side vary.

## Scope

In: admin pages (help, guides, setup checklist, tour, two missing features) and
accessibility across every screen, admin and student.

Out: help for the iPad, printer and student side. That stays with the one-page
handout (ticket 1.13).

## Decisions

1. **Help content is one typed module in code** (`src/lib/help/`). Every guide,
   page panel, checklist step and tour step comes from it, so no two surfaces
   can describe a page differently, and tests can check it against the app.
   Rejected: Markdown (no checks against the app), admin-editable CMS (drift and
   an editor to build).
2. **The tour is built in-house** on the native `<dialog>` element. Tour
   libraries position floating popovers in ways that break screen readers and
   small screens. It is opened by a "Show me around" button and never starts by
   itself.
3. **Accessibility is enforced by axe in the end-to-end suite**, on every
   screen at every tested size, plus a manual pass for what automation cannot
   judge (focus order, focus after navigation, announcements, error wording).
4. **The setup checklist is computed from real data**, with nothing stored and
   no migration.

## Admin home

Top to bottom: greeting and "Show me around"; the setup checklist until
complete, then a one-line "Setup complete" that can be reopened; "Needs
attention" (failed receipts, open shifts); today's numbers; the help center.

Checklist steps, each done when:

| Step | Done when | Links to |
|---|---|---|
| Add your students | one or more active students | Students |
| Check the teachers and add emails | one or more active teachers with an email | Teachers |
| Set up the menu | one or more active menu items | Menu |
| Pair the cart's iPad | any shift has ever been clocked in (clock-in only works on a paired device) | guide |
| Run a first sale | any order exists | guide |
| Give another staff member access (optional) | two or more admins | Admins |

The help center lists guides by topic with a filter box, each guide expanding
into numbered steps and a button to the page it concerns, and a glossary.

## Guides

Getting started; students (add, forgotten PIN or lockout, leaving, hours and
rewards); teachers (add, email for receipts, notes students see, leaving); menu
(add, change a price, the special, add-ons and free extras, take off); orders
and receipts (a day's sales, a missing receipt, statuses, retry or dismiss);
access (signing in, shared devices, giving and removing access).

## Help on every page

A "What this page is for" panel under each admin page title, listing the page's
common tasks as links to their guides. Collapsible per person; the choice is
remembered on the device. Hints under the fields people get wrong, tied to the
field with `aria-describedby`.

## Tour

Steps are declared in the help module against `data-tour` attributes on the
page. A step scrolls its target into view, outlines it, and explains it in a
modal `<dialog>` with Back, Next and Done. Escape closes and focus returns to
the button that opened it. On phones the dialog is a bottom sheet. Reduced
motion disables smooth scrolling.

## Features the guides need

- **Add a teacher** on the admin Teachers page, reusing the cart's validation.
- **Admins page**: list who has access, add by name and email, remove. Neither
  yourself nor the last admin can be removed.

## Accessibility, whole app

axe on every screen; the admin menu button becomes a real `<button>`; a skip
link; focus moves to the page heading after navigation; form errors tied to
their fields and announced; success announced; visible focus everywhere;
targets at least 24px on admin (60px on student screens already); reflow at
320px and 200% zoom; reduced motion respected; the PIN pad announces how many
digits are entered; totals and change announced as they change.

## Testing

Help content integrity (every admin route has help, every guide link resolves,
every tour step's target exists on its page); checklist logic against the
database; the admin-removal rules; a keyboard-only tour; axe on every screen.

## Build order

Each stage ships on its own: 1) accessibility and axe, 2) add teacher and the
Admins page, 3) help content and per-page help, 4) admin home checklist and
help center, 5) the tour.
