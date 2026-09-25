# PocketClerk — Build Game Plan

**Project:** Student-run coffee cart POS + employment training app (first deployment: a special-education work program)
**Builder:** Colin Hendrickson · **Client:** program administrator
**Repo name:** `pocketclerk` (school name lives in config, never in code or repo name)
**Status:** V1 and V2 built and deployed; V4 (go-live hardening, below) built after the first deployment met real users. V3 is open.

---

## 1. Goals

| Goal | Definition of success |
|---|---|
| Working tool | Students run a full shift independently: clock in → orders → change → receipt → inventory → clock out |
| Modular | Printer, email, and document rendering are swappable providers; zero business-logic changes to swap |
| White-label | Ships brand-neutral: names, logo, main color, and reward currency are deploy config or admin settings. Another program deploys from the README without touching code |
| Portfolio piece | Public repo, live demo, CI badges, README that sells it in 30 seconds |

**Non-goals (V1):** real payments, native app, offline-first sync, multi-school tenancy (design for it, don't build it), configurable workflows, and any theme builder. White-label = names, a main color, logo, reward currency. Nothing more. (Ticket 4.7 added one color picker for staff; that is the whole of it.)

---

## 2. Stack

| Layer | Choice | Cost |
|---|---|---|
| Frontend/backend | Next.js (App Router) + TypeScript + Tailwind + daisyUI (custom theme) | Free |
| Delivery | Web app on the cart's iPad, opened in the Bluefy browser (for Web Bluetooth), locked with Guided Access | Free |
| Database | Supabase Postgres + Drizzle ORM over postgres.js, through Supabase's session pooler | Free tier |
| Auth (admins) | Self-hosted emailed code or link + allowlist table | Free |
| Auth (students) | Name tap + 4-digit PIN (no accounts) on a paired device | Free |
| Email | Resend, custom domain, reply-to = the program admin's school address | Free tier |
| Receipts | Plain-text renderer; ESC/POS to a 58mm Bluetooth LE thermal printer over Web Bluetooth; HTML email | Free |
| Hosting | Vercel Hobby + Vercel Cron (daily receipt sweep) | Free |
| Domain | pocket-clerk.com (already owned) | ~$10/yr renewal |

---

## 3. Architecture: provider pattern

Every external effect sits behind an interface. This is the modularity story AND the interview story. The real interfaces are in `src/providers/`.

```ts
interface ReceiptPrinter {
  print(receipt: Receipt): Promise<PrintResult>;
}
interface EmailSender {
  sendText(message: TextMessage): Promise<SendResult>;
}
// Renderers are pure functions: renderReceiptText(receipt), renderSignInEmail(...)
```

| Interface | Built | Swap-in later |
|---|---|---|
| ReceiptPrinter | `WebBluetoothPrinter` (ESC/POS over Web Bluetooth, probes the GATT services cheap printers use), `ConsolePrinter` for development | `CloudPrntPrinter` (Star) or `EposPrinter` (Epson) for a networked printer |
| EmailSender | `ResendSender`, `ConsoleSender` when no API key is set | School SMTP if it ever exists |
| Renderers | Text receipt, HTML sign-in email | Paycheck PDF with ticket 3.1 |

The first plan was a PDF receipt through the iOS print sheet (AirPrint). It was replaced by Web Bluetooth when the printer turned out to be a cheap 58mm Bluetooth thermal printer, which AirPrint cannot reach; see ticket 4.8.

**Receipt job queue (cart moves, WiFi is flaky):**

- Completing an order NEVER blocks on printing or email.
- Order completion inserts a row into `receipt_jobs` (status: `queued → processing → sent | failed`).
- Print and email are async consumers of that queue: the iPad claims print jobs, the server sends email right after the sale and again in a daily sweep.
- WiFi drops in a classroom → order still saves → receipt goes out when connectivity returns.
- Admin sees per-order delivery status; failed jobs have a retry button.

---

## 4. Data model

```
persons (id, name, email, created_at)
├── teacher_profiles (person_id, room, notes[], active)        ← customer data
├── admin_users (person_id, added_by, created_at)               ← allowlist
└── admin_login_tokens (person_id, token_hash, code_hash, attempts, expires_at, used_at)
students (id, display_name, pin_hash, failed_attempts, locked_until, active)
shifts (id, student_id, clock_in, clock_out, hours_hundredths, reward_tickets, checklist)
menu_items (id, name, price_cents, category, is_special, active, sort_order)
addons (id, name, price_cents, active, sort_order)
orders (id, shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
order_items (order_id, menu_item_id, name and price snapshot, qty)
order_item_addons (order_item_id, addon_id, name_snapshot, price_cents)
receipt_jobs (id, order_id, channel: print|email, status, attempts, last_error)
inventory_items (id, name, unit, par_level, active, sort_order)
inventory_counts (id, shift_id, item_id, starting, remaining, restocked, counted_at)
site_settings (id = 1, primary_color, updated_by, updated_at)   ← one row
```

Planned with ticket 3.1, not yet built: `pay_periods`, `paychecks`.

Decisions baked in:

- **Admin + customer = same person.** The program admin is one `persons` row with both a `teacher_profile` and an `admin_users` entry. Revoking admin never touches their order history.
- **Money in integer cents, hours in integer hundredths.** Always. No floats.
- **Payment method per order** (`cash` | `card`). V1 only ever writes `cash`; the column and the nullable `received_cents`/`change_cents` exist so a card/badge method (ticket 3.7) can be added without a migration. Card is deferred because the client's spec is cash-only and making change is the core lesson.
- **Soft deletes** (`active` flags) on menu, students, teachers. School data never hard-deletes.
- Every price is copied onto the order row at sale time so menu edits never rewrite history.

---

## 5. Phases and tickets

Every commit names its ticket: `feat(4.8): ...`. Work that is not on this list gets a ticket here first.

### V1 — Core loop

| # | Ticket | Acceptance criteria | Status |
|---|---|---|---|
| 1.1 | Project scaffold | Next.js + Drizzle + Supabase + CI green on push | Done |
| 1.2 | Schema + seed script | `pnpm seed` creates fake students/teachers/menu; demo data only | Done |
| 1.3 | Student sign-in + clock in | Tap name → PIN → clocked in; double clock-in impossible | Done |
| 1.4 | Employee dashboard | Shows date, clock-in time, live hours; 5 big buttons | Done |
| 1.5 | Teacher lookup + create | Search/select or add new (name, room, email); notes shown prominently | Done |
| 1.6 | Order builder | Menu grid, add-ons, special treat toggle, qty, running total | Done |
| 1.7 | Make change screen | Enter money received (bill buttons + keypad) → change displayed HUGE with denomination hint; received < owed cannot continue. Cash only in V1 | Done |
| 1.8 | Complete order + receipt job | Order saved with full snapshot; receipt_jobs row queued | Done |
| 1.9 | Printed receipt | Receipt reaches paper. Planned as a PDF through the iOS print sheet; built as ESC/POS over Web Bluetooth (4.8) | Done, differently |
| 1.10 | Email receipt (Resend) | Uses saved email; status visible | Done |
| 1.11 | Today's orders view | List + totals for current shift | Done |
| 1.12 | Clock out + reward tickets | Hours computed, tickets = floor(hours), shift saved | Done |
| 1.13 | Guided Access setup doc | One-page instructions for the program admin (iPad settings): `docs/IPAD_SETUP.md` | Done |

### V2 — Operations

| # | Ticket | Status |
|---|---|---|
| 2.1 | Inventory count screen (per shift) | Done |
| 2.2 | Restock list + restocked checkoffs | Done |
| 2.3 | End-of-shift checklist gate before clock out | Done |
| 2.4 | Admin auth (emailed code or link + allowlist) | Done |
| 2.5 | Admin: students CRUD, hours, ticket totals | Done |
| 2.6 | Admin: teachers CRUD, notes, order history | Done (favorites not built) |
| 2.7 | Admin: menu + special treat + add-on pricing | Done |
| 2.8 | Admin: orders browser (by date) | Done (by date; by student or teacher not built) |
| 2.9 | Receipt job monitor + retry | Done |

### V3 — Payroll, reports, polish

| # | Ticket | Status |
|---|---|---|
| 3.1 | Pay period generation + paycheck PDF (signature line blank, "SIMULATED — NO CASH VALUE") | Open |
| 3.2 | Reports: student work, sales, teacher customer, inventory | Open |
| 3.3 | Export All (CSV/JSON) button | Open |
| 3.4 | Scheduled backup → JSON dump emailed to admin | Open |
| 3.5 | Real printer integration behind ReceiptPrinter | Done as 4.8 |
| 3.6 | Public demo at pocket-clerk.com: landing page, demo banner, admin entry without email, console-only email, hourly reset in one transaction (ADR 14) | Done |
| 3.7 | Card/badge payment (deferred from V1, client to opt in): "How is [teacher] paying?" screen, badge confirmation modal, admin toggle for enabled methods | Open |

### V4 — Go-live hardening

Built after the first deployment met real staff and students. Each came from something that went wrong or was asked for.

| # | Ticket | Why | Status |
|---|---|---|---|
| 4.1 | Production reliability | Pages hung for 300s: postgres.js's two-step parameterized queries were split by Supabase's transaction pooler; moved to the session pooler. Plus closing idle connections before Vercel suspends an instance | Done |
| 4.2 | Device pairing | Student screens only on a paired device (`DEVICE_CODE`), so names are not public; server actions check it too | Done |
| 4.3 | Responsive layouts | The admin side is used on phones; every screen works from 320px to desktop, per DESIGN.md §3 | Done |
| 4.4 | Accessibility, WCAG 2.2 AA | Whole app; axe on every screen at five sizes in CI, keyboard and focus tests | Done |
| 4.5 | Staff manage access | Admins page (give/remove access, never yourself or the last admin); add a teacher from the admin side | Done |
| 4.6 | Admin guidance | Several staff share the admin side: setup checklist, 25+ guides with search, help on every page, "Show me around" tour | Done |
| 4.7 | Staff-chosen main color | The school's colors, set on a Colors page and stored in the database, with a readability gate | Done |
| 4.8 | Receipt printing on iPad | Web Bluetooth ESC/POS to a 58mm BLE thermal printer (first deployment: PT-210), in the Bluefy browser; staff guide | Done, awaiting a test on the real printer |
| 4.9 | Product mark | PocketClerk logo, favicon, home-screen icons, web app manifest | Done |
| 4.10 | Open-source readiness | Licence, contributing and security docs, accurate README, ADRs for every architectural decision | Done |
| 4.11 | Nothing names the school before sign-in | The address is public; sign-in pages, the manifest and metadata say only PocketClerk, and search engines are asked to stay away | Done |
| 4.12 | Student sign-in at /cart | Frees / for the landing page; / on a school's copy still reaches the cart | Done |
| 4.13 | One copy per school | Each school on its own subdomain, project and database; pocket-clerk.com becomes the demo (ADR 14) | Done |

---

## 6a. Design system (decided)

Locked via Claude Design pass 2; full spec lives in `docs/DESIGN.md`.

| Decision | Value |
|---|---|
| Direction | Warmed Shift Ledger: warm off-white base, teal primary, dark left rail with vertical steps |
| Font | Manrope 600/700/800 (distinct 1/I/l and 0/O, tabular figures). Nunito considered and rejected |
| Themes | `pocketclerk` (default) + `sample` (proof) committed; a deployment's main color is set by staff (4.7), stored in the database, never committed |
| Type scale | One scale, all themes; change amount 184-192px is the only text at that size in the app, shrinking only to fit a narrow card |
| Primitives | BigButton, MoneyDisplay, NoteBanner, StepHeader, ChangeCard, Keypad/BillButtons, ShiftStats, TeacherCard, Logo, Admin shell, HelpPanel, TourButton. PaymentChoice and BadgeModal wait for 3.7 |
| Casing | Student-facing labels sentence case in every theme; `.btn` text-transform reset |

## 6. UX rules (non-negotiable, this audience is the point)

- One primary action per screen; app always advances to the next step itself.
- Touch targets ≥ 60px on student screens, ≥ 24px on admin; text large; minimal reading.
- No free-text typing except teacher notes and email (admin can handle both).
- Change amount displayed in the largest type in the app.
- Destructive actions require confirm; students cannot reach admin or other students' data.
- "What do I do next?" must be answerable by looking at the screen.

---

## 6b. White-label configuration

The public repo never references the real school. The first deployment is private config.

| Config | Public repo default | A real deployment |
|---|---|---|
| `NEXT_PUBLIC_PROGRAM_NAME` / `NEXT_PUBLIC_CART_NAME` | Maple Grove Learning Program / Sunrise Snack Cart | Real names, in the host's environment |
| `NEXT_PUBLIC_REWARD_NAME` | Tickets | The program's own name for the reward |
| `NEXT_PUBLIC_LOGO_URL` | The PocketClerk mark | The program's logo, in the sign-in email |
| Main color | `pocketclerk` theme teal | Set by staff on the admin Colors page; stored in `site_settings` |
| Seed data | Fake teachers/students | Real data via admin |

## 7. Security & privacy

| Rule | Implementation |
|---|---|
| Student/teacher data not public | RLS on every table with no anonymous policies but the menu and settings; the app ships no Supabase key and reaches Postgres only from the server; admin routes and every server action check the session |
| Student screens | Only on a paired device (`DEVICE_CODE`); every student server action checks the pairing |
| PINs | Hashed; five wrong in a row lock the student for 15 minutes, counted atomically so parallel guesses cannot slip through |
| Real data never in repo | Seed script = fake data; `.env` for everything school-specific |
| School not googleable from repo | No school name, logo URL, or deployment mention anywhere in code, commits, or issues. Grep for the school and cart names before every push |
| Loss protection | Supabase backups; Export All and scheduled backup are 3.3 and 3.4 |

---

## 8. Portfolio plan

| Item | Detail |
|---|---|
| README | Screenshots, architecture overview, provider-pattern explanation, "run locally in a few commands" |
| Live demo | pocket-clerk.com, demo banner, hourly reset, fake data (3.6) |
| White-label proof | `/themes` shows the same screen in two themes side by side |
| CI | GitHub Actions: typecheck, lint, Vitest against Postgres, Playwright with axe; badge in README |
| Tests | Vitest on money math and every database rule; Playwright: a whole shift, every screen at five sizes with axe, keyboard, tour, colors, menu prices, admin access |
| ADRs | `docs/adr/`: one per architectural decision |
| Positioning | "White-label POS + workforce training platform; first deployment is a special-education program." Not "a coffee app for one school." |
| Resume bullet | Offline-tolerant job queue, provider abstraction, accessibility-first UI, RLS security model |

---

## 9. Build order (as it happened)

| When | Did |
|---|---|
| Weekend 1 | Tickets 1.1–1.8 |
| Weekend 2 | 1.9–1.13, V2, first deployment |
| First week live | V4: every item came from the first real users |
| Next | 3.1–3.4, 3.6; 3.7 only if the client asks |

---

## 10. Open items

| Item | Owner | Blocking |
|---|---|---|
| Test printing on the real PT-210 in Bluefy | Colin, with the program admin | 4.8 sign-off |
| Real teacher/student list | Program admin | Go-live only, not development |
| Clear practice orders and shifts before the first real shift | Colin | Go-live |
| Pay period cadence (weekly? monthly?) | Program admin | 3.1 |
