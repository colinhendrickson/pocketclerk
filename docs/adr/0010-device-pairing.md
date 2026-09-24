# 10. Student screens only on a paired device

Status: accepted (ticket 4.2)

## Context

The student sign-in screen lists students by first name, because tapping your
name is how a student signs in. On a public URL, that list is readable by anyone
who finds the address. For children in a special-education program, a public
roster is not acceptable, and students have no accounts that could gate it.

## Decision

A deployment sets `DEVICE_CODE`. An adult opens `/setup?code=…` once on the
cart's iPad, which sets a long-lived signed cookie. Every student page, and every
student server action, checks for it first; without it, the visitor sees a "not
set up" page that names nothing. Server actions check it too, because an action
is its own POST endpoint and never passes through the page that rendered the
button.

The connection link is shown to administrators on Admin home, with a way to email
it to themselves, since connecting the cart's iPad is their job.

Without `DEVICE_CODE` the cart is open, which is right for local development and
the public demo.

## Consequences

The roster is not public, with no accounts and nothing for a student to type.

The cookie belongs to one browser on one device. Connecting the iPad in Safari
does not connect it in Bluefy ([ADR 9](0009-receipts-over-web-bluetooth.md)), and
the help says so. Rotating `DEVICE_CODE` disconnects every device at once, which is
also how a lost iPad is dealt with.
