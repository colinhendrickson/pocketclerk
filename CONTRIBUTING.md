# Contributing

Thanks for looking. PocketClerk is a small, opinionated codebase, and the rules
below are what keep it that way. They are the same rules the maintainer works by;
[`CLAUDE.md`](CLAUDE.md) is the short version.

## Running it

See [Run it locally](README.md#run-it-locally) in the README. You need Node 22.12
or newer, pnpm, and Docker for the local Postgres.

## Before you open a pull request

```bash
pnpm check        # typecheck, lint, and unit + database tests
pnpm test:e2e     # the browser tests, including axe accessibility checks
```

CI runs the same, against a real Postgres. A pull request needs both green.

If `pnpm test:e2e` suddenly shows Next.js 404 pages for routes that exist, a
production build has left files in `.next` that confuse the dev server. Delete
`.next` and run it again.

## The rules

**Tickets.** Work is planned in [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md). Every
commit names its ticket: `feat(4.8): receipts print through Bluefy on iPad`.
Docs, tests and chores use `docs(…)`, `test(…)` and `chore(…)` with the ticket too. If what you
want to do is not a ticket, propose it as one first.

**Money is integer cents.** Columns and variables end in `_cents` or `Cents`.
Hours are integer hundredths. No floats, no `numeric` columns. Money math lives in
`src/lib/money.ts` as pure functions, and its tests land before any UI. See
[ADR 1](docs/adr/0001-money-as-integer-cents.md).

**Where code goes.** `src/app/` is routes and server actions only. Business logic
lives in `src/lib/`, importable without the framework. Anything that talks to the
outside world (printing, email, rendering) goes through an interface in
`src/providers/`.

**The database enforces what matters.** A new table gets row level security and
its policies in the same migration. Rules that must never be broken are
constraints, not only TypeScript checks. School data is never hard-deleted.

**Accessibility is not optional.** The whole app meets WCAG 2.2 AA, and the
end-to-end suite runs axe on every screen at five sizes. Student screens also
follow [`docs/DESIGN.md`](docs/DESIGN.md): 60px touch targets, sentence case,
one primary button, no free-text typing.

**Privacy.** Never commit a real school, program, cart, teacher or student name,
an email address, or a school's colors. Branding comes from environment
variables and the admin Colors page; seed data is fake.

**Tests prove something.** A test for a bug should fail on the old code. The
commit history has examples of saying so.

## Dependency overrides

`package.json` pins two transitive packages under `pnpm.overrides`:

- `eslint-plugin-react-hooks` stays on v5: v7 loads `@babel/core` without
  declaring it, which crashes ESLint before it reads a file.
- `drizzle-kit`'s bundled `@esbuild-kit/core-utils` gets esbuild 0.25 or newer,
  which fixes a development-server advisory. drizzle-kit only uses it to compile
  config and schema files.

Remove an override once the package that needed it no longer does.

## Reporting a security problem

Privately, please: see [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).
