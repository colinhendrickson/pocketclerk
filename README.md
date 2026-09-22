# PocketClerk

[![CI](https://github.com/colinhendrickson/pocketclerk/actions/workflows/ci.yml/badge.svg)](https://github.com/colinhendrickson/pocketclerk/actions/workflows/ci.yml)

A white-label point-of-sale and workforce-training app for student-run carts.
Students clock in, take orders from customers they learn to remember, count
change, print receipts, and clock out to earn simulated wages.

The first deployment is a special-education work program at a K-8 school. The
app ships brand-neutral: names, colours, logo and reward currency are deployment
config, so another program can run it without touching code.

![Making change](docs/screenshots/make-change.png)

---

## Why it looks the way it does

The primary users are students with disabilities, so accessibility was a
constraint on the architecture rather than a finishing pass. It decided the
information architecture:

- One primary action per screen. The app advances itself to the next step.
- Touch targets at least 60px. No hover-only affordances.
- Sentence case on student screens, even where the deployment's brand style uses
  capitals, because capitals measurably slow emerging readers.
- The change amount is the largest text in the app and appears at that size
  nowhere else.
- No free-text entry anywhere in the student flow except teacher notes.

| | |
|---|---|
| ![Sign in](docs/screenshots/signin.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| Tap your name. No typing, no dropdown. | Four steps of a shift, one primary action. |

![Order builder](docs/screenshots/order-builder.png)

Saved notes about a customer render above the menu and cannot be collapsed.
Remembering the customer is one of the program's stated goals, so the layout
enforces it rather than trusting the student to look.

## Architecture

Six decisions carry the design. Each has a record in [`docs/adr/`](docs/adr)
covering the constraint that forced it and what it costs.

**Money is integer cents, everywhere.** No `numeric` column, no float, no
exceptions. Hours are integer hundredths. Formatting happens in exactly one
function, called only from components. The money module imports neither the
database nor React, so its tests run with no mocks.
→ [ADR 1](docs/adr/0001-money-as-integer-cents.md)

**Receipts are queued, not sent inline.** Completing an order writes the order,
its lines and its receipt jobs in one transaction containing no network calls. A
dead printer or dropped WiFi delays a receipt and never costs a sale.
→ [ADR 2](docs/adr/0002-receipt-job-queue.md)

**Row Level Security is the floor, not the student authorization layer.**
Students have no database identity by design, so RLS closes the public surface
to admin-or-nothing while the server enforces student scope against a signed
session cookie. The boundary is drawn deliberately and written down.
→ [ADR 3](docs/adr/0003-rls-and-the-trust-boundary.md)

**Invariants live in the database.** One open shift per student is a partial
unique index, because two concurrent requests can both pass an `if` but cannot
both satisfy a unique index. An order whose change does not add up is
unrepresentable, not merely rejected. Both are asserted by tests that name the
constraint that fires.
→ [ADR 4](docs/adr/0004-invariants-in-the-database.md)

**Effects sit behind interfaces.** Printing, email and document rendering are
provider interfaces in `src/providers/`. Each has a console implementation that
is the default when no key and no hardware are present, so a fresh clone can
complete an order and see the receipt it would have produced.
→ [`src/providers`](src/providers)

**Themes are data.** Two themes ship in the repo and no component names a
colour, so switching `data-theme` is the entire re-skin. A deployment's palette
never enters git.
→ [ADR 6](docs/adr/0006-themes-as-data.md)

### The printer is attached to the tablet, not the network

Worth calling out because it shaped the queue. iPadOS refuses classic Bluetooth
to anything without MFi certification, and MFi printers start around $250, so the
only affordable printer a web page can reach is a Bluetooth Low Energy one,
driven from the browser. That means print jobs are claimed by the tablet and
email jobs by the server, which is why `ReceiptPrinter` carries a `runsOn` field.

Cheap ESC/POS boards are sold under many names and disagree about which GATT
service carries the writable characteristic, so the driver probes a list of known
candidates rather than hard-coding one vendor.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 + daisyUI 5 · Postgres via
Drizzle · Resend · Vercel

## Run it

Requires Node 20.12+, pnpm and Docker. No cloud account, no API keys.

```bash
pnpm install
cp .env.example .env.local
pnpm db:up && pnpm db:migrate && pnpm seed
pnpm dev
```

Open http://localhost:3000 and sign in as any student. Every seeded PIN is
`1234`. Completed orders print to the console, because no printer is attached.

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, including the database constraint suite |
| `pnpm build` | Production build |
| `pnpm db:up` / `db:down` | Local Postgres in Docker |
| `pnpm seed` | Fake data, fixed seed, reproducible |

CI runs typecheck, lint, migrations, seed, tests and build against a real
Postgres on every push.

## White-label

Branding is configuration with fictional defaults. A deployment supplies its own
values through the environment; nothing school-specific is committed.

| Config | Repo default |
|---|---|
| `NEXT_PUBLIC_PROGRAM_NAME` | Maple Grove Learning Program |
| `NEXT_PUBLIC_CART_NAME` | Sunrise Snack Cart |
| `NEXT_PUBLIC_REWARD_NAME` | Tickets |
| `NEXT_PUBLIC_THEME` | `pocketclerk` |

Visit `/themes` to see the same components under both committed themes.

## Documentation

| Document | Contents |
|---|---|
| [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) | Goals, data model, tickets, acceptance criteria |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system: themes, type scale, breakpoints, primitives |
| [`docs/adr/`](docs/adr) | Architecture decision records |

## Status

The V1 shift loop is complete: sign in, clock in, take orders, count change,
view today's orders, clock out. Inventory, the admin area and payroll are the
next phases; see the game plan.

## Licence

Not yet chosen.
