# 14. One copy per school, and a demo mode

Status: accepted (tickets 3.6, 4.11–4.13)

## Context

pocket-clerk.com served the first school's cart. Anyone who found the address
saw the school's program and cart names on the sign-in pages, and there was no
way to look at the app without being on staff. A second school would have had
nowhere to go.

Two shapes were possible. One multi-tenant app, with every table keyed by a
school and every query filtered by it, would make one missing filter a leak of
one school's students to another. Or one copy of the app per school, each with
its own database, where a school can only ever see its own data because it is
the only data there.

## Decision

**One copy per school.** Each school gets its own Vercel project and Supabase
database, deployed from this repository, on its own subdomain of
pocket-clerk.com. The subdomain does not name the school. Nothing in the code
knows about more than one school.

**Two site modes**, chosen by `NEXT_PUBLIC_SITE_MODE` (`src/lib/site-mode.ts`):

- `instance`, the default, is a school's copy. `/` redirects to the student
  sign-in at `/cart`. Before sign-in no page, the manifest or the metadata
  names the school: they say PocketClerk. `robots.txt` and a `noindex` tag ask
  search engines to stay away.
- `demo` is pocket-clerk.com itself: a landing page at `/`, and the whole app
  on made-up data. A banner on every page says it is a demo that resets every
  hour. Visitors try the cart with no pairing, or enter the admin side with a
  button instead of an email. Email is never sent, whatever keys are set.

**The demo's powers need two things.** The mode, and the database's own flag,
`site_settings.is_demo`, which only `pnpm seed --demo` sets. A school's copy
with demo mode set by mistake still refuses the admin button, because its
database says it is not the demo.

**The demo resets itself.** The first request after an hour schedules a reseed
with `after()`, so the visitor is not kept waiting. The seed runs in one
transaction under an advisory lock: two resets at once seed once, and a reader
sees the old cart or the new one, never half of either. **Start over** in the
banner reseeds on demand, at most every five minutes. This needs no cron, which
matters on Vercel's Hobby plan (one cron a day).

## Consequences

- Isolation between schools is structural, not a filter that must be
  remembered. It costs a Vercel project and a Supabase project per school, and
  migrations are applied to each database.
- The demo is shared: one visitor's orders are visible to the next until the
  reset. That is the point of a demo, and the banner says so.
- Moving the first school to its subdomain meant pairing the iPad again and
  staff signing in again, because cookies belong to an address.
- The e2e suite runs the demo on its own server and database
  (`scripts/demo-db.ts`), so its resets never touch the data the other specs
  rely on.
