# Deploying

Two services, both on free tiers: Supabase for Postgres, Vercel for the app.
Budget about forty minutes the first time, most of it waiting for DNS.

Each school gets its own copy: its own Supabase database and its own Vercel
project, from this repository, on its own address
([ADR 14](adr/0014-one-copy-per-school-and-a-demo.md)). Schools share nothing,
so one school can never see another's students. The steps below set up one
school's copy; repeat them for the next school.

Do these in order. Each step depends on the one before it.

---

## 1. Supabase: the database

1. Create a project at [supabase.com](https://supabase.com). Choose a region
   near the school; every query pays that round trip.
2. Save the database password it shows you. It is displayed once.
3. Press **Connect** at the top of the project and copy both:
   - **Session pooler** (port **5432**, host `…pooler.supabase.com`). This is
     `DATABASE_URL`. The **Transaction pooler** string (port 6543) works too:
     the app moves it to the session port itself.
   - **Session pooler** again, or the **Direct connection** if your network has
     IPv6. This is `DIRECT_URL`, for migrations.

The app runs on the session pooler, not the transaction pooler, because the
transaction pooler split its parameterised queries and left pages hanging for
five minutes ([ADR 8](adr/0008-session-pooler-and-idle-connections.md)). Each app
instance holds one connection and closes it after a few idle seconds, so session
mode's cost in connections does not matter at this scale.

The app also disables prepared statements automatically on any Supabase pooler
string, which is safe in both pooler modes.

## 2. Apply the schema

From your machine, pointed at the new database:

```bash
DIRECT_URL="postgresql://postgres:...@...:5432/postgres" pnpm db:migrate
```

Do **not** run `pnpm seed` against production. It truncates every table, and it
creates fictional people. Real names enter through the admin interface.

### Using the Vercel integration instead

Vercel's Supabase integration provisions `POSTGRES_URL` (pooled) and
`POSTGRES_URL_NON_POOLING` (direct), among others. The app reads those names as
well, so switching the integration on means you can skip setting `DATABASE_URL`
and `DIRECT_URL` by hand, and the credentials stay in sync if the database
password is ever rotated.

It also creates several `SUPABASE_*` variables that this app does not use. They
are harmless; this project talks to Postgres directly rather than through the
Supabase client library.

## 3. Vercel: the app

1. Import the repository at [vercel.com](https://vercel.com). It detects
   Next.js; no build settings to change.
2. Add environment variables under **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler string (session, 5432; a 6543 string is moved to 5432). Skip if using the integration |
| `DIRECT_URL` | Supabase session pooler or direct string, for migrations. Skip if using the integration |
| `SESSION_SECRET` | 32+ random bytes, see below |
| `NEXT_PUBLIC_APP_URL` | The deployment's own address |
| `CRON_SECRET` | Another random string |
| `RESEND_API_KEY` | From step 4, or leave unset at first |
| `EMAIL_FROM` | `receipts@yourdomain` |
| `EMAIL_REPLY_TO` | The program administrator's school address |
| `NEXT_PUBLIC_PROGRAM_NAME` | The real program name |
| `NEXT_PUBLIC_CART_NAME` | The real cart name |
| `NEXT_PUBLIC_REWARD_NAME` | The program's name for the reward, e.g. `Stars` |
| `NEXT_PUBLIC_LOGO_URL` | Optional: a logo for the sign-in email |
| `NEXT_PUBLIC_TIME_ZONE` | The cart's time zone, see step 6 |
| `DEVICE_CODE` | A long random value, see step 7 |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Mark `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET`,
`RESEND_API_KEY` and `DEVICE_CODE` as **Sensitive**.

The site's main color is not an environment variable. After deploying, staff set
it on the admin **Colors** page ([ADR 11](adr/0011-staff-chosen-main-color.md)).

`NEXT_PUBLIC_APP_URL` must match how the app is actually reached. Sign-in links
are built from it, so a wrong value sends the administrator somewhere that does
not exist.

`NEXT_PUBLIC_` variables are readable in the browser. That is correct for
branding, which is printed on screen and on receipts, and wrong for anything
else. Nothing secret uses that prefix.

3. Deploy.

## 4. Email (optional at first)

Without `RESEND_API_KEY` the app logs receipts instead of sending them, and
everything else works. Add it when you are ready.

The Resend integration on the Vercel marketplace sets `RESEND_API_KEY` for you,
which is exactly the variable this app reads, so it is worth using. You still
have to set `EMAIL_FROM` and `EMAIL_REPLY_TO` yourself.

1. Create a [Resend](https://resend.com) account and add your domain.
2. Add the DNS records it gives you. Allow up to a day to verify.
3. Set `EMAIL_FROM` to an address on that domain. It must be a domain you
   control: mail claiming to be from a domain it cannot prove is mail that lands
   in spam.
4. Set `EMAIL_REPLY_TO` to the administrator's school address, so a teacher
   replying to a receipt reaches a person.

## 5. Create the first administrator

A fresh deployment has an empty allowlist, and sign-in checks that allowlist, so
without this step nobody can get in.

From your machine, pointed at production:

```bash
DATABASE_URL="<session pooler or direct string>" pnpm admin:add "Mrs. Example" admin@school.example
```

After that, administrators add each other on the admin **Admins** page; nobody
needs the script again.

If that address already belongs to a teacher, the script reuses their record
rather than creating a second one. The administrator is usually also a customer,
and should keep one order history either way.

Re-running it is a no-op, so it is safe to use as a check.

## 6. Real data

Sign in at `/admin/sign-in`. Admin home has a setup checklist that walks through
the rest: students, teachers with their emails, the menu, connecting the cart's
iPad, and a first sale. Every admin page has step-by-step help and a "Show me
around" tour. Real data enters only through the interface, never the seed.

Each student needs a four-digit PIN. Pick something they can remember; it is not
protecting anything valuable, and being locked out mid-shift is the real cost.

### Time zone

Vercel and Supabase run on UTC. Set the zone the cart actually operates in, as
type **Config**:

```
NEXT_PUBLIC_TIME_ZONE = America/New_York
```

Without it, times are shown in `America/New_York`. That is right for the
Eastern zone and wrong everywhere else, and the failure is silent: pages load
normally and receipts are simply hours off. `/api/health` reports the zone in
use.

## 7. Lock the cart to the school's iPad

Without this, anyone who finds the address can read the first names of every
student on the roster and sit guessing four-digit PINs. Rate limiting makes the
guessing impractical; it does nothing about the names, and the names are the
part that matters.

Set one more variable in Vercel, type **Secret**, and redeploy:

```
DEVICE_CODE = <a long random value>
```

Generate one with the same command as the other secrets. Then, once on each iPad
that should run the cart, open the connection link. Administrators find it on
Admin home, in the setup checklist, with a button to email it to themselves:

```
https://your-domain/setup?code=<that value>
```

On an iPad with a receipt printer, open it in **Bluefy**, not Safari: each browser
keeps its own connection, and only Bluefy can reach the printer (step 8).

That stores a signed cookie on the device and lasts a school year. Every student
screen requires it. A visitor without it sees only "this device is not set up",
with no names, no menu and no way in.

Changing `DEVICE_CODE` un-pairs every device at once, which is how to revoke a
lost iPad.

The administrator side is deliberately unaffected: it is gated by an emailed
link to an allowlisted address, which is a stronger check and has to work from
any laptop.

## 8. The iPad

Follow [`IPAD_SETUP.md`](IPAD_SETUP.md): install the Bluefy browser, connect the
iPad in it, turn on Guided Access, set auto-lock to never.

Receipts print on a small 58mm Bluetooth Low Energy thermal printer (the first
deployment uses a PT-210) over Web Bluetooth. Safari has no Web Bluetooth, and
neither does a web app on the home screen, so the cart runs in
[Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055), a
free browser that does ([ADR 9](adr/0009-receipts-over-web-bluetooth.md)).

---

## How receipts are delivered

Completing an order writes the order and its receipt jobs in one transaction
containing no network calls, then delivers the email after the response has
already reached the student. A slow mail provider cannot make the cart feel
slow, and a failed send leaves the job queued rather than losing it.

A scheduled sweep runs once a day and picks up anything that could not be
delivered at the time. **Once a day is a free-plan limit**, not a design choice:
Vercel's Hobby plan rejects any cron expression more frequent than daily, and a
deployment that tries fails to build. On a paid plan, change the schedule in
`vercel.json` to `*/5 * * * *` and receipts retry every five minutes instead.

Print jobs are not delivered by the server at all. The printer is reached from
the iPad over Bluetooth, so the tablet claims its own print jobs and prints them
once a student presses **Connect printer**. The admin guide "Setting up the
receipt printer" has the steps.

## Checking it worked

Load **`/api/health`** first. It answers, in one request, whether the deployment
is configured: which required settings are missing by name, whether the database
is reachable, and whether the migrations have run. It returns 200 when the app
is ready and 503 when it is not.

It reports names, never values. Use it before anything else; it turns "the site
is broken" into a specific missing variable.

1. `/admin/sign-in` emails a six-digit code, and typing it signs you in. The
   same mail carries a link, which does the same thing on a computer.
2. A test order completes and shows the right change.
3. `/admin/receipts` shows the receipt as `sent`, or shows why it is not.
4. `/admin/orders` shows the order.

## A school on a subdomain of pocket-clerk.com

1. In the school's Vercel project, **Settings → Domains**, add the subdomain,
   for example `cart1.pocket-clerk.com`. Pick a name that does not identify the
   school: the address is public even when nothing on it is.
2. In Cloudflare DNS, add the `CNAME` record Vercel shows for it, **DNS only**
   (grey cloud). Cloudflare's proxy in front of Vercel caused timeouts.
3. Set `NEXT_PUBLIC_APP_URL` to `https://cart1.pocket-clerk.com` and redeploy,
   or sign-in links point at the old address.
4. Moving an existing school to a new address signs everyone out, because
   cookies belong to an address: pair the iPad again (step 7) and staff sign
   in again.

Never set `NEXT_PUBLIC_SITE_MODE=demo` on a school's copy. Its database would
still refuse the demo's powers, but the landing page would replace the cart.

## The public demo

pocket-clerk.com is the same code in demo mode, with a database of its own.

1. A separate Supabase project, with the schema applied (step 2), then seeded
   as the demo's:

   ```bash
   DATABASE_URL="<the demo database>" pnpm seed --demo
   ```

2. A separate Vercel project from this repository, with `DATABASE_URL`,
   `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL=https://pocket-clerk.com` and
   `NEXT_PUBLIC_SITE_MODE=demo`. No `DEVICE_CODE`, no `RESEND_API_KEY`, no
   branding: the defaults are the made-up cart.
3. `pocket-clerk.com` and `www.pocket-clerk.com` on that project.

It resets itself on the first visit after each hour, and on **Start over** at
most every five minutes. No cron is needed.

## Things that can go wrong

**"DATABASE_URL is not set"** on Vercel means the variable was added to only one
environment. Check that Production is ticked, and redeploy: environment changes
do not apply to an existing deployment.

**Migrations hang or fail.** You are pointed at the transaction pooler (6543).
Migrations need a session: `DIRECT_URL` on the session pooler or the direct
connection, port 5432.

**A page hangs for minutes, then fails.** Look at the database while it hangs
(`select state, wait_event, query from pg_stat_activity`). A query "active" and
waiting on `ClientRead` is the transaction-pooler problem in ADR 8; check that the
app is on the session pooler.
