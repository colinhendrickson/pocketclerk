# Neutral pocket-clerk.com, public demo, one copy per school — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pocket-clerk.com becomes a landing page and a shared, hourly-reset demo; each school's cart runs as its own copy on its own subdomain, showing nothing about the school before sign-in.

**Architecture:** One codebase, two modes chosen by `NEXT_PUBLIC_SITE_MODE` (`instance` default, `demo`). Demo mode serves a landing page at `/`, a demo banner on every page, a guarded demo-admin entry, console-only email and a self-triggered hourly reset from a seed that runs in one transaction. The student sign-in moves to `/cart` in both modes.

**Tech Stack:** Next.js 16 App Router, Drizzle + postgres.js, Vitest, Playwright + axe-core.

**Spec:** `docs/specs/2026-09-24-landing-demo-and-instances-design.md`

## Global Constraints

- Nothing identifies a school before sign-in on an instance: no program or cart name in any signed-out page's HTML, the manifest, or metadata.
- Demo admin entry requires BOTH `NEXT_PUBLIC_SITE_MODE=demo` AND `site_settings.is_demo = true`.
- Demo email never leaves the app: console sender whatever keys are set.
- Hourly reset; Start over at most once every 5 minutes.
- The demo banner is on every demo page, including the landing page: "This is a demo. Everything resets every hour."
- Every commit names its ticket: 3.6, 4.11, 4.12, 4.13.
- WCAG 2.2 AA; axe clean at the five sizes of `tests/e2e/responsive.spec.ts`.

## Review Focus

- An instance with `NEXT_PUBLIC_SITE_MODE=demo` set by mistake: demo-admin must refuse (database flag false). Test in Task 3.
- Two resets at once (two first-visits after the hour): one runs, the other skips; no half-seeded database. Advisory lock test in Task 3.
- Old bookmarks and the paired iPad opening `/` on an instance: must land on the cart. Test in Task 2.
- Start over pressed repeatedly: throttled, no error. Test in Task 3.
- The school's name hidden in HTML attributes (e.g. `data-cart`) on signed-out pages: the e2e check reads page source, not visible text. Test in Task 1.

---

### Task 1: Nothing identifies a school before sign-in (4.11)

**Files:**
- Create: `src/lib/site-mode.ts`, `src/app/robots.ts`, `tests/site-mode.test.ts`, `tests/e2e/public-pages.spec.ts`
- Modify: `src/app/(admin)/admin/layout.tsx` (signed-out title), `src/app/(admin)/admin/sign-in/page.tsx`, `src/app/(admin)/admin/verify/page.tsx`, `src/app/(student)/not-set-up/page.tsx`, `src/app/(student)/layout.tsx` (drop `data-cart`), `src/app/manifest.ts` (name "PocketClerk"), `src/app/layout.tsx` (robots metadata)

**Interfaces:** Produces `siteMode(): "instance" | "demo"` (reads `NEXT_PUBLIC_SITE_MODE`, anything else is `instance`) and `PRODUCT_NAME = "PocketClerk"`.

- [ ] Test `siteMode()`: unset, `"instance"`, junk → `instance`; `"demo"` → `demo`.
- [ ] Implement; run; pass.
- [ ] E2E `public-pages.spec.ts`: for `/admin/sign-in`, `/not-set-up`, `/admin/verify?token=x`, `/manifest.webmanifest`: fetch the raw response body and assert it contains neither `branding.cartName` nor `branding.programName` (read from env the same way the app does), and contains "PocketClerk". Assert `/robots.txt` disallows `/`. Run: FAIL (sign-in shows program name; student layout has `data-cart`).
- [ ] Signed-out admin title, sign-in, verify, not-set-up and manifest use `PRODUCT_NAME`; remove `data-cart`; `robots.ts` returns `disallow: "/"` in instance mode and allows `/` in demo; root metadata `robots: { index: false, follow: false }` in instance mode.
- [ ] Run unit + e2e; pass. Commit `feat(4.11): nothing on a school's copy names the school before sign-in`.

### Task 2: Student sign-in at /cart (4.12)

**Files:**
- Move: `src/app/(student)/page.tsx` → `src/app/(student)/cart/page.tsx`
- Create: `src/app/page.tsx` (instance: `redirect("/cart")`)
- Modify: every `redirect("/")`, `router.replace("/")`, `href="/"` under `src/app/(student)` (13 sites listed by `grep`), `src/app/setup/route.ts` (both redirects), `tests/e2e/*.spec.ts` (`goto("/")` → `goto("/cart")`, `toHaveURL(/\/$/)` → `/\/cart$/`)

- [ ] E2E in `shift.spec.ts`: "opening / on a school's copy lands on the cart" (goto `/`, expect URL `/cart`). Run: FAIL.
- [ ] Move the page, add `src/app/page.tsx`, update every reference (re-run the grep until empty).
- [ ] Run all e2e; pass. Commit `feat(4.12): the student sign-in lives at /cart; / sends a school's copy there`.

### Task 3: Demo data, reset and guard (3.6)

**Files:**
- Create: `drizzle/0011_*.sql` (via `drizzle-kit generate`), `src/db/seed-data.ts`, `src/lib/demo.ts`, `tests/demo.test.ts`
- Modify: `src/db/schema.ts` (`siteSettings.isDemo boolean not null default false`, `demoResetAt timestamptz`), `src/db/seed.ts` (calls `seedDatabase`, `--demo` flag)

**Interfaces:**
- `seedDatabase(options: { demo: boolean }): Promise<"seeded" | "busy">` — one transaction guarded by `pg_try_advisory_xact_lock(<const>)`; truncates as today, re-creates the `site_settings` row (TRUNCATE CASCADE from persons empties it) with `is_demo = options.demo`, `demo_reset_at = now()`.
- Pure: `resetDue(lastReset: Date | null, now: Date): boolean` (≥ 1 hour or null); `canStartOver(lastReset: Date | null, now: Date): boolean` (≥ 5 minutes or null).
- `isDemo(): Promise<boolean>` — `siteMode() === "demo"` and `site_settings.is_demo`.
- `maybeResetDemo(): Promise<void>` — if `isDemo()` and `resetDue`, schedule `seedDatabase({ demo: true })` with `after()`.

- [ ] Tests: `resetDue` / `canStartOver` at the boundaries (59m59s false, 60m true; 4m59s false, 5m true; null true).
- [ ] DB tests (against the test database; the file ends by re-running `seedDatabase({ demo: false })` so later tests see the normal seed): `seedDatabase({demo:true})` sets `is_demo`; `{demo:false}` leaves it false; two concurrent calls return one `"seeded"` and one `"busy"`; `isDemo()` false when mode is demo but flag false, and when flag true but mode instance.
- [ ] Migration, schema, `seed-data.ts`, `demo.ts`; `pnpm seed` keeps working, `pnpm seed --demo` sets the flag.
- [ ] Run; pass. Commit `feat(3.6): demo data that resets in one transaction, and a guard needing both mode and database`.

### Task 4: Demo behaviour: banner, admin entry, email, reset hooks (3.6)

**Files:**
- Create: `src/components/demo-banner.tsx` (server), `src/app/demo/actions.ts` (`enterDemoAdmin`, `startOver`)
- Modify: `src/app/layout.tsx` (banner when `siteMode() === "demo"`), `src/providers/email/index.ts` (console in demo), `src/lib/admin-auth.ts` (export `startSessionFor` as `startAdminSession`), admin and student layouts (`await maybeResetDemo()`)

- [ ] Unit: `getEmailSender()` returns the console sender in demo mode with `RESEND_API_KEY` set.
- [ ] Banner: `role="region" aria-label="Demo"`, text "This is a demo. Everything resets every hour.", a **Start over** form button (`startOver` → `canStartOver` → `seedDatabase` → `redirect("/")`), meets AA.
- [ ] `enterDemoAdmin`: refuses unless `isDemo()`; signs in as the seeded admin; redirects `/admin`.
- [ ] Commit `feat(3.6): the demo banner, admin entry, console-only email and hourly reset`.

### Task 5: The landing page (3.6)

**Files:** Modify `src/app/page.tsx` (demo: `<Landing />`); create `src/app/landing.tsx`.

- [ ] Content: headline and one-line pitch; who it is for; four ideas (built for students with disabilities, change on every sale, a $30 printer, WCAG 2.2 AA); screenshots from `docs/screenshots` copied to `public/landing/`; **Try the cart** (`/cart`) and **Look around as an admin** (`enterDemoAdmin`); links to GitHub and `docs/DEPLOYMENT.md`. Sentence case, one primary button, daisyUI semantic classes only.
- [ ] Commit `feat(3.6): a landing page at pocket-clerk.com`.

### Task 6: Demo end to end (3.6)

**Files:** `next.config.ts` (`distDir: process.env.NEXT_DIST_DIR ?? ".next"`), `playwright.config.ts` (second project `demo` with its own `webServer`: `NEXT_DIST_DIR=.next-demo NEXT_PUBLIC_SITE_MODE=demo DATABASE_URL=<…/pocketclerk_demo> next dev -p 3100`), `scripts/demo-db.ts` (create database if missing, migrate, `seedDatabase({demo:true})`), `tests/e2e/demo.spec.ts`, `.github/workflows/ci.yml` (run `scripts/demo-db.ts` before e2e), `.gitignore` (`.next-demo`).

- [ ] `demo.spec.ts`: landing shows banner and both buttons; **Try the cart** reaches the student list without pairing; **Look around as an admin** reaches Admin home; **Start over** returns to `/` with the banner; axe clean on the landing page at 390 and 1440.
- [ ] Commit `test(3.6): the demo in a real browser, on its own database`.

### Task 7: Docs, then the move (4.13)

- [ ] ADR 14 "One copy per school, and a demo mode"; DEPLOYMENT.md (demo project; a new school on a subdomain; never set demo mode on a school); README (live demo link); GAME_PLAN (tickets 4.11–4.13, 3.6 done); `.env.example` (`NEXT_PUBLIC_SITE_MODE`). Commit `docs(4.13): …`.
- [ ] Move (needs the owner): subdomain name that does not identify the school; Supabase demo project; Vercel demo project from this repo with `NEXT_PUBLIC_SITE_MODE=demo`; `pocket-clerk.com` and `www` to the demo project; the subdomain to the school's project; the DNS record in Cloudflare; the school's `NEXT_PUBLIC_APP_URL`; seed the demo database with `pnpm seed --demo`; re-pair the iPad; verify `/api/health` on both.
