# PocketClerk

[![CI](https://github.com/colinhendrickson/pocketclerk/actions/workflows/ci.yml/badge.svg)](https://github.com/colinhendrickson/pocketclerk/actions/workflows/ci.yml)

A white-label point-of-sale and workforce-training app for student-run carts. Students clock in, take orders from customers they learn to remember, count change, print receipts, run inventory, and clock out to earn simulated wages.

The first deployment is a special-education work program at a K-8 school. The app ships brand-neutral: names, colours, logo, and reward currency are deployment config, so another program can run it without touching code.

> **Status:** in development. V1 is the core shift loop. See [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) for tickets and acceptance criteria.

---

## Why it looks the way it does

The primary users are students with disabilities, so accessibility was an engineering constraint rather than a finishing pass. It drove the information architecture:

- One primary action per screen. The app advances itself to the next step.
- Touch targets at least 60px; no hover-only affordances.
- Sentence case on student screens, even where the deployment's brand style uses capitals, because capitals measurably slow emerging readers.
- The change amount is the largest text in the app and appears at that size nowhere else.
- Every screen answers "what do I do next?" without being read closely.

## Architecture

**Effects sit behind interfaces.** Printing, email, and document rendering are provider interfaces in `src/providers/`, so business logic depends on contracts rather than vendors. Swapping the receipt printer for a specific model is one new file and zero changed call sites.

**Receipts never block a sale.** The cart roams classrooms on school WiFi. Completing an order writes the order, its items, and a `receipt_jobs` row in one transaction; delivery is an asynchronous consumer with retries. A dropped connection delays a receipt and never loses an order or miscounts money.

**Money is integer cents, everywhere.** No floats, no `numeric` columns. Hours are integer hundredths. Formatting happens only at the display edge. Change calculation is a pure function, unit-tested, because it is the one bug that would teach a student the wrong answer.

**Invariants live in the database.** One open shift per student is a partial unique index, not an `if` statement, because two concurrent requests can both pass a check but cannot both satisfy an index. Cash and card field rules are a `CHECK` constraint. Row Level Security is enabled on every table in the migration that creates it.

**History is immutable.** Prices are snapshotted onto order rows at sale time, and menu, teacher, and student records soft-delete. Editing today's menu can never rewrite last month's sales.

## Stack

Next.js (App Router) · TypeScript · Tailwind 4 + daisyUI 5 · Supabase Postgres + Drizzle · Resend · react-pdf · Vercel

## Run locally

Requires Node 22.12 or newer and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase and Resend values
pnpm dev
```

Open http://localhost:3000.

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm build` | Production build |

## White-label

Branding is configuration with fictional defaults. A deployment supplies its own values through environment variables; nothing school-specific is committed.

| Config | Repo default |
|---|---|
| `PROGRAM_NAME` / `CART_NAME` | Maple Grove Learning Program / Sunrise Snack Cart |
| `REWARD_NAME` | Tickets |
| `LOGO_URL` | Text wordmark fallback |
| `THEME` | `pocketclerk` |

Themes are daisyUI themes, which are plain CSS custom properties. Two ship in the repo: `pocketclerk` and a `sample` proof theme. A deployment skin overrides the same properties at runtime from private config, so a real school's colours never enter this repository.

## Documentation

| Document | Contents |
|---|---|
| [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) | Goals, data model, tickets, acceptance criteria |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system: themes, type scale, breakpoints, component primitives |
| `docs/adr/` | Architecture decision records |

## Licence

Not yet chosen.
