# Security

PocketClerk holds data about students, many of them minors in a special-education
program, and about the staff who serve them. Security reports are taken seriously
and answered quickly.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository. That opens a private
advisory that only the maintainers can see.

Include what you found, how to reproduce it, and what an attacker could do with
it. You will get an acknowledgement within a few days.

## What is in scope

- Anything that exposes student, teacher or staff data to someone who should not
  see it: the student list, names, PINs, hours, orders, emails.
- Signing in as an administrator without owning an allowlisted email address, or
  keeping access after it has been removed.
- Using the student screens from a device that has not been paired.
- Guessing a student's PIN faster than the lockout allows.
- Charging a different amount than the menu price, or changing a past order.

## How the app is built to resist these

The design decisions are written up in [`docs/adr/`](docs/adr/). In short:

- The server is the only thing that talks to the database. Every table has row
  level security enabled, and the app ships no Supabase key to the browser
  ([ADR 0003](docs/adr/0003-rls-and-the-trust-boundary.md)).
- Every server action checks its own permission: the admin session or the paired
  device. Nothing relies on a page having hidden a button.
- Admins sign in with a single-use emailed code or link, checked against an
  allowlist on every request ([ADR 0007](docs/adr/0007-self-hosted-sign-in-links.md)).
- PINs are hashed, and wrong guesses are counted in one atomic update, so a burst
  of parallel guesses locks the student out like a slow one would.
- Invariants that matter live in the database as constraints, not only in
  TypeScript ([ADR 0004](docs/adr/0004-invariants-in-the-database.md)).

## Supported versions

Only the latest commit on `main` is supported.
