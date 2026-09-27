# A neutral pocket-clerk.com, a public demo, and one copy per school — design

Date: 2026-09-24 · Status: built

## Why

pocket-clerk.com is the first school's live cart. Anyone who opens it sees the
school's program and cart names on the admin sign-in and "not set up" pages. The
address should say nothing about any school, show what PocketClerk is, and let a
visitor try it; each school's cart should live somewhere of its own.

## Decisions

1. **One copy per school.** Each school keeps its own deployment and its own
   database, as the first one has now. Separate databases are the strongest
   guarantee that one school's records can never reach another's. Serving many
   schools from one app (multi-tenancy) is revisited at around three schools; the
   game plan already lists it as "design for it, don't build it".
2. **The same code runs in two modes**, chosen by `NEXT_PUBLIC_SITE_MODE`:
   - `instance` (the default): a school's cart, as today.
   - `demo`: pocket-clerk.com. A landing page, and the whole app on fake data.
3. **The demo is shared and resets hourly.** A per-visitor sandbox was
   considered and rejected: it needs either a copy of every table per visitor or a
   visitor label on every row, which is the multi-tenancy work of decision 1 in
   another form, and it changes the database layer the live carts depend on.
4. **Nothing identifies a school before sign-in.** In instance mode, signed-out
   pages show only PocketClerk, and search engines are told not to index the site.

## pocket-clerk.com (demo mode)

- **`/`** is a landing page: what PocketClerk is and who it is for, the
  screenshots, the ideas that make it different (built for students with
  disabilities, change taught on every sale, a $30 printer, WCAG 2.2 AA), and two
  buttons: **Try the cart** and **Look around as an admin**. Links to the GitHub
  repository and the deployment guide for anyone who wants their own copy.
- **The cart** opens with no pairing (pairing is off in demo mode).
- **Look around as an admin** signs the visitor in as the demo administrator,
  with no email. It works only when both the deployment is in demo mode *and* the
  database says it is a demo (`site_settings.is_demo`, set by the demo seed, never
  by migrations). A real school's database never has that flag, so a mistake in a
  deployment's settings cannot open its admin side to strangers.
- **Nothing leaves the demo.** Email always goes to the console sender, whatever
  keys are set; printing is the console printer unless a visitor connects a real
  printer from their own device.
- **Hourly reset.** Vercel's free plan runs scheduled jobs once a day, so the
  demo resets itself: the first request after an hour runs the seed again, after
  the response, in one transaction. A banner on every page says "This is a demo.
  Everything resets every hour", with **Start over**, which resets on demand at
  most once every five minutes.
- The demo has its own Supabase project, on the free tier, with fake data only.

## Routes

The student sign-in moves from `/` to `/cart`, in both modes, so that `/` can be
the landing page on the demo. On a school's copy `/` redirects to `/cart`, so
existing bookmarks and the iPad keep working. Pairing and every internal link go
to `/cart`.

## A school's copy (instance mode)

- The first school moves from pocket-clerk.com to its own subdomain of it. The
  subdomain must not name the school: certificate transparency logs make every
  subdomain public. Staff sign in once more and the cart's iPad is connected once
  more, because both are tied to the address.
- The admin sign-in, sign-in link and "not set up" pages show PocketClerk's name
  and mark, not the school's.
- `robots.txt` disallows everything and every page carries `noindex`.
- A new school: a new Vercel project and Supabase project from the same
  repository, following `docs/DEPLOYMENT.md`, on its own subdomain.

## Tickets

- 3.6 Demo mode: landing page, demo admin, banner, hourly and on-demand reset.
- 4.11 Nothing identifies a school before sign-in; noindex on instances.
- 4.12 Student sign-in at `/cart`; `/` redirects on an instance.
- 4.13 First school on its own subdomain; pocket-clerk.com on the demo project.

## Testing

- Unit: the mode switch; the demo-admin guard refuses unless both mode and
  database flag agree; the reset throttle.
- Database: the demo seed sets the flag; the real migrations never do.
- End to end (demo mode): landing page, try the cart, look around as admin,
  Start over; axe on the landing page at every size.
- End to end (instance mode): no school name on any signed-out page; `/`
  redirects to `/cart`; every existing spec passes at the new path.

## Out of scope

Multi-tenancy; per-visitor sandboxes; a contact form or sign-up flow for new
schools (the landing page links to GitHub and the deployment guide).
