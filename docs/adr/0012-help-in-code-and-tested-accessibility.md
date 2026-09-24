# 12. The admin side explains itself, and accessibility is tested, not reviewed

Status: accepted (tickets 4.4, 4.6)

## Context

Several staff share the admin side, some opening it a few times a term. Every
question they could not answer from the app went to the developer. And the whole
app has to meet WCAG 2.2 AA, because the students using the cart are in a
special-education program and the staff vary.

## Decision

**Help is one typed module in code** (`src/lib/help`). Guides, the "About this
page" panel on every admin page, the setup checklist's wording and the "Show me
around" tour all read from it, so a task is never described two ways. Rules that
live elsewhere (the PIN lockout, how long a sign-in code lasts) are imported, not
retyped. Tests hold it to the app: every admin page is listed and renders its
panel, every guide a page lists exists, every page a guide points to exists, and
every tour step's `data-tour` target exists in the source.

Markdown was rejected because nothing would check it against the app; an editable
CMS because the help would drift and an editor would have to be built.

**The tour is built in-house** on the native modal `<dialog>`, which traps focus,
closes on Escape and is announced as a dialog without any of it being rebuilt.
Tour libraries position floating popovers in ways that break screen readers and
small screens. It never opens by itself.

**The setup checklist is computed from data.** A step is done when what it asks
for exists; the iPad is proven connected by the first clock-in, which only a
connected device can do. Nothing is stored, so it cannot be ticked without the
work being done.

**Accessibility is enforced in CI.** The end-to-end suite runs axe against WCAG
2.2 A and AA on every screen at five sizes, from a 320px phone to a desktop, and
fails on any violation. What axe cannot judge is tested by keyboard: the skip
link, focus moving to a new page's heading, the menu drawer, the tour.

## Consequences

A new admin can set the cart up and handle the common problems without asking
anyone, and the help cannot quietly go wrong when the app changes.

Changing a guide's wording is a code change, made by a developer. For a small
program that is acceptable; the alternative was staff editing text that no test
checks.

Every new screen is held to AA by the same test that already runs, so
accessibility does not depend on someone remembering to review it.
