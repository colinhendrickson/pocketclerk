# 16. Several students on one shift

Status: accepted (ticket 4.21)

## Context

The cart's iPad held one signed-in student: a signed cookie naming their open
shift, which every sale, count and checklist used. The first program runs the
cart with two or three students at once, and signing in a second simply
replaced the first. The first student's shift stayed open with nothing on the
iPad pointing at it, so nobody could clock them out, and the next time they
signed in on a later day the cart closed it with no hours (ticket 4.16).

Point-of-sale systems keep two things apart: each employee's timecard, and
who is operating the register. The cart had folded both into one shift.

## Decision

Keep the shift as the student's timecard and allow several at once; the
database already allowed one open shift per student, not one per cart.

- **The crew belongs to the iPad.** A second signed cookie lists every shift
  clocked in on this device (`src/lib/crew.ts`, `src/lib/session.ts`). It is
  signed in its own domain so a shift cookie cannot be replayed as a crew.
  Shifts that have closed, or are from an earlier day, drop out when read.
- **One student is at the register.** The existing shift cookie now means that.
  Their sales go on their shift, so receipts, the Orders page and per-student
  reports keep saying who served, with no change to orders.
- **Joining needs a PIN; switching does not.** Signing in while someone is
  working adds a worker and puts them at the register. A "Working now" panel
  on the dashboard switches the register to any crew member with one tap: they
  proved who they are on this iPad when they joined, and nobody's hours change.
  Only shifts in this iPad's crew can be chosen.
- **Each student clocks out alone.** Hours and rewards are their own. When the
  student at the register leaves, whoever has worked longest takes over.
- **The last one out closes the cart.** Only they get the closing checklist;
  anyone leaving earlier just clocks out.
- **Today's orders shows the whole cart**, with who served each, since a
  student's own orders would hide everyone else's.

## Alternatives

- **A cart-session table** owning orders, inventory and the checklist, with
  shifts as pure timecards. Cleaner in the abstract, but it touches every sales
  query and report, needs a migration applied to every copy before deploy, and
  loses "served by" unless a per-order choice is added. The cookie crew gives
  the program what it asked for with no schema change, and leaves that table
  possible later.
- **A site-wide crew** (every open shift today). Simpler, but on the public
  demo strangers would see and switch into each other's shifts, and a second
  iPad would share one register.

## Consequences

- A crew is per device: two iPads are two crews. That matches one cart.
- A student who walks off without clocking out keeps the crew open, so the
  last student does not get the closing list. Their name stays on the "Working
  now" panel, where a teacher can switch to them and clock them out, and Admin
  home still lists every open shift.
- Inventory counts stay on the shift of whoever counts, as before.
