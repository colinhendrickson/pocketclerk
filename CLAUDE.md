# PocketClerk rules

Tickets and acceptance criteria live in `docs/GAME_PLAN.md`. The design system lives in `docs/DESIGN.md`. Reference tickets by number.

## Money
- Money is ALWAYS integer cents, columns and variables suffixed `_cents` / `Cents`. Hours are integer hundredths. No floats, no `numeric` columns.
- Format money only at the display edge, inside components. Never in `lib/` or server actions.
- Money math lives in `src/lib/money.ts` as pure functions with no imports from db or React. Tests land before UI.

## Architecture
- `src/app/` holds routes and server actions only. Business logic lives in `src/lib/` and is importable without the framework.
- All external effects (print, email, PDF rendering) go through the interfaces in `src/providers/`. Never call Resend, a printer API, or react-pdf directly from app code.
- Completing an order never blocks on printing or email. It inserts a `receipt_jobs` row; consumers deliver asynchronously.
- Prices are snapshotted onto order rows at sale time. Menu, students, and teachers soft-delete with `active = false`. Never hard-delete school data.

## Database
- Every table gets Row Level Security enabled and policies written in the same migration that creates it.
- Invariants go in the database, not just TypeScript: partial unique index for one open shift per student, CHECK constraint for cash vs card fields.
- `DATABASE_URL` is the pooled connection for runtime. `DIRECT_URL` is for migrations only.

## UI
- Use daisyUI semantic classes and the primitives defined in `docs/DESIGN.md` only. No ad hoc hex colors, no ad hoc font sizes.
- Student-facing screens: sentence case, touch targets at least 60px, exactly one `btn-primary` per screen, no free-text typing except teacher notes and email.
- The change amount is the largest text in the app and appears at that size nowhere else.

## Privacy and white-label
- Never write a real school name, program name, cart name, teacher or student name, email, or the school's theme values anywhere in code, docs, commits, or issues. Branding comes from `src/lib/branding.ts` with fictional defaults; real values exist only in production env.
- Seed data is fake. Real data enters only through the admin UI.

## Process
- Each ticket ships with: migration (if schema), implementation, tests for any money math, and a screenshot reviewed against `docs/DESIGN.md`.
- Commit per ticket, message format `feat(1.7): short description`. Docs, tests and chores use `docs(...)`, `test(...)` and `chore(...)`.
