# Deploying

Two services, both on free tiers: Supabase for Postgres, Vercel for the app.
Budget about forty minutes the first time, most of it waiting for DNS.

Do these in order. Each step depends on the one before it.

---

## 1. Supabase: the database

1. Create a project at [supabase.com](https://supabase.com). Choose a region
   near the school; every query pays that round trip.
2. Save the database password it shows you. It is displayed once.
3. Go to **Project Settings → Database → Connection string** and copy both:
   - **Transaction pooler**, port **6543**. This is `DATABASE_URL`.
   - **Direct connection**, port **5432**. This is `DIRECT_URL`.

Two URLs on purpose. Serverless functions open many short-lived connections and
the pooler absorbs them, but the pooler strips session features that migrations
need. Getting them the wrong way round produces either exhausted connections
under load or migrations that fail with no obvious cause.

The app disables prepared statements automatically when it detects a pooled
connection string. Supabase's pooler hands a different backend connection to
each statement, so a prepared statement made on one is not there for the next.
Without that, the app fails in production in ways it never fails locally.

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
| `DATABASE_URL` | Supabase pooler string, port 6543. Skip if using the integration |
| `DIRECT_URL` | Supabase direct string, port 5432. Skip if using the integration |
| `SESSION_SECRET` | 32+ random bytes, see below |
| `NEXT_PUBLIC_APP_URL` | The deployment's own address |
| `CRON_SECRET` | Another random string |
| `RESEND_API_KEY` | From step 4, or leave unset at first |
| `EMAIL_FROM` | `receipts@yourdomain` |
| `EMAIL_REPLY_TO` | The program administrator's school address |
| `NEXT_PUBLIC_PROGRAM_NAME` | The real program name |
| `NEXT_PUBLIC_CART_NAME` | The real cart name |
| `NEXT_PUBLIC_REWARD_NAME` | e.g. `Blue Tickets` |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Mark `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET` and
`RESEND_API_KEY` as **Sensitive**.

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
DATABASE_URL="<direct connection string>" pnpm admin:add "Mrs. Example" admin@school.example
```

Use the **direct** connection for this, not the pooler.

If that address already belongs to a teacher, the script reuses their record
rather than creating a second one. The administrator is usually also a customer,
and she should keep one order history either way.

Re-running it is a no-op, so it is safe to use as a check.

## 6. Real data

Sign in at `/admin/sign-in` and add students, teachers and the menu through the
interface. Never through the seed.

Each student needs a four-digit PIN. Pick something they can remember; it is not
protecting anything valuable, and being locked out mid-shift is the real cost.

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
that should run the cart, open:

```
https://your-domain/setup?code=<that value>
```

That stores a signed cookie on the device and lasts a school year. Every student
screen requires it. A visitor without it sees only "this device is not set up",
with no names, no menu and no way in.

Changing `DEVICE_CODE` un-pairs every device at once, which is how to revoke a
lost iPad.

The administrator side is deliberately unaffected: it is gated by an emailed
link to an allowlisted address, which is a stronger check and has to work from
any laptop.

## 8. The iPad

Follow [`IPAD_SETUP.md`](IPAD_SETUP.md): add to the home screen, turn on Guided
Access, set auto-lock to never.

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

Print jobs are not delivered by the server at all. The printer is paired to the
iPad over Bluetooth, so the tablet claims its own print jobs; see the README.

## Checking it worked

Load **`/api/health`** first. It answers, in one request, whether the deployment
is configured: which required settings are missing by name, whether the database
is reachable, and whether the migrations have run. It returns 200 when the app
is ready and 503 when it is not.

It reports names, never values. Use it before anything else; it turns "the site
is broken" into a specific missing variable.

1. `/admin/sign-in` sends you a link, and the link signs you in.
2. A test order completes and shows the right change.
3. `/admin/receipts` shows the receipt as `sent`, or shows why it is not.
4. `/admin/orders` shows the order.

## Two things that will go wrong

**"DATABASE_URL is not set"** on Vercel means the variable was added to only one
environment. Check that Production is ticked, and redeploy: environment changes
do not apply to an existing deployment.

**Migrations hang or fail.** You are pointed at the pooler. Migrations need
`DIRECT_URL`, port 5432.
