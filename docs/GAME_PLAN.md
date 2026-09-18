# PocketClerk — Build Game Plan

**Project:** Student-run coffee cart POS + employment training app (first deployment: a special-education work program)
**Builder:** Colin Hendrickson · **Client:** program administrator
**Repo name:** `pocketclerk` (school name lives in config, never in code or repo name)
**Status target:** V1 live before the cart's first fall shift

---

## 1. Goals

| Goal | Definition of success |
|---|---|
| Working tool | Students run a full shift independently: clock in → orders → change → receipt → inventory → clock out |
| Modular | Printer, email, and paycheck rendering are swappable providers; zero business-logic changes to swap |
| White-label | Ships brand-neutral: names, theme, logo, and reward currency are deploy config. Another program deploys from the README without touching code |
| Portfolio piece | Public repo, live demo, CI badges, README that sells it in 30 seconds |

**Non-goals (V1):** real payments, native app, offline-first sync, multi-school tenancy (design for it, don't build it), configurable workflows, and any theme-builder UI. White-label = names, colors, logo, reward currency. Nothing more.

---

## 2. Stack

| Layer | Choice | Cost |
|---|---|---|
| Frontend/backend | Next.js (App Router) + TypeScript + Tailwind + daisyUI (custom theme) | Free |
| Delivery | PWA, Add to Home Screen on iPad, run under Guided Access | Free |
| Database | Supabase Postgres + Drizzle ORM | Free tier |
| Auth (admins) | Supabase Auth magic links + allowlist table | Free |
| Auth (students) | Name tap + 4-digit PIN (no accounts) | Free |
| Email | Resend, custom domain, reply-to = the program admin's school address | Free tier |
| PDFs (receipt/paycheck) | @react-pdf/renderer | Free |
| Hosting | Vercel Hobby + Vercel Cron (weekly backup email) | Free |
| Domain | pocket-clerk.com (already owned) | ~$10/yr renewal |

---

## 3. Architecture: provider pattern

Every external effect sits behind an interface. This is the modularity story AND the interview story.

```ts
interface ReceiptPrinter {
  print(job: ReceiptJob): Promise<PrintResult>;
}
interface EmailSender {
  send(msg: ReceiptEmail | PaycheckEmail): Promise<SendResult>;
}
interface DocumentRenderer {
  renderReceipt(order: Order): Promise<Buffer>;   // 80mm PDF
  renderPaycheck(pay: PayPeriod): Promise<Buffer>; // letter PDF
}
```

| Interface | V1 impl | Swap-in later |
|---|---|---|
| ReceiptPrinter | `PdfPrintSheet` (renders 80mm PDF, opens iOS print sheet, works on any AirPrint device) | `CloudPrntPrinter` (Star) or `EposPrinter` (Epson) once the deployment's printer model is known |
| EmailSender | `ResendSender` | School SMTP if it ever exists |
| DocumentRenderer | react-pdf | Unlikely to change |

**Receipt job queue (cart moves, WiFi is flaky):**

- Completing an order NEVER blocks on printing or email.
- Order completion inserts a row into `receipt_jobs` (status: `queued → sent/printed → failed`).
- Print and email are async consumers of that queue.
- WiFi drops in a classroom → order still saves → receipt goes out when connectivity returns.
- Admin sees per-order delivery status; failed jobs have a retry button.

---

## 4. Data model

```
persons (id, name, email, created_at)
├── teacher_profiles (person_id, room, notes[], created_at)   ← customer data
├── admin_users (person_id, auth_id, added_by)                ← allowlist
students (id, display_name, pin_hash, active)
shifts (id, student_id, clock_in, clock_out, hours, blue_tickets)
menu_items (id, name, price_cents, category, active, is_special)
addons (id, name, price_cents, active)
orders (id, shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
order_items (id, order_id, menu_item_id, qty, price_cents)
order_item_addons (order_item_id, addon_id, price_cents)
receipt_jobs (id, order_id, channel: print|email, status, attempts, last_error)
inventory_items (id, name, unit, par_level, active)
inventory_counts (id, shift_id, item_id, starting, remaining, restocked_bool)
pay_periods (id, start, end, generated_at)
paychecks (id, pay_period_id, student_id, hours, blue_tickets, pdf_path)
```

Decisions baked in:

- **Admin + customer = same person.** The program admin is one `persons` row with both a `teacher_profile` and an `admin_users` entry. Revoking admin never touches their order history.
- **Money in integer cents.** Always. No floats.
- **Payment method per order** (`cash` | `card`). V1 only ever writes `cash`; the column and the nullable `received_cents`/`change_cents` exist so a card/badge method (ticket 3.7) can be added without a migration. Card is deferred because the client's spec is cash-only and making change is the core lesson.
- **Paychecks are derived** from shifts; the `paychecks` table just snapshots what was generated and signed.
- **Soft deletes** (`active` flags) on menu, students, teachers. School data never hard-deletes.
- Every price is copied onto the order row at sale time so menu edits never rewrite history.

---

## 5. Phases and tickets

### V1 — Core loop (build first, ship before touching V2)

| # | Ticket | Acceptance criteria |
|---|---|---|
| 1.1 | Project scaffold | Next.js + Drizzle + Supabase + CI green on push |
| 1.2 | Schema + seed script | `pnpm seed` creates fake students/teachers/menu; demo data only |
| 1.3 | Student sign-in + clock in | Tap name → PIN → clocked in; double clock-in impossible |
| 1.4 | Employee dashboard | Shows date, clock-in time, live hours; 5 big buttons |
| 1.5 | Teacher lookup + create | Search/select or add new (name, room, email); notes shown prominently |
| 1.6 | Order builder | Menu grid, add-ons, special treat toggle, qty, running total |
| 1.7 | Make change screen | Enter money received (bill buttons + keypad) → change displayed HUGE with denomination hint; received < owed cannot continue. Cash only in V1 |
| 1.8 | Complete order + receipt job | Order saved with full snapshot; receipt_jobs row queued |
| 1.9 | PDF receipt + print sheet | 80mm PDF renders, iOS print sheet opens |
| 1.10 | Email receipt (Resend) | Uses saved email; prompts once if missing; status visible |
| 1.11 | Today's orders view | List + totals for current shift |
| 1.12 | Clock out + blue tickets | Hours computed, tickets = floor(hours), shift saved |
| 1.13 | Guided Access setup doc | One-page instructions for the program admin (iPad settings) |

### V2 — Operations

| # | Ticket |
|---|---|
| 2.1 | Inventory count screen (per shift) |
| 2.2 | Restock list + restocked checkoffs |
| 2.3 | End-of-shift checklist gate before clock out |
| 2.4 | Admin auth (magic link + allowlist) |
| 2.5 | Admin: students CRUD, hours, ticket totals |
| 2.6 | Admin: teachers CRUD, notes, order history, favorites |
| 2.7 | Admin: menu + special treat + add-on pricing |
| 2.8 | Admin: orders browser (by date/student/teacher) |
| 2.9 | Receipt job monitor + retry |

### V3 — Payroll, reports, polish

| # | Ticket |
|---|---|
| 3.1 | Pay period generation + paycheck PDF (signature line blank, "SIMULATED — NO CASH VALUE") |
| 3.2 | Reports: student work, sales, teacher customer, inventory |
| 3.3 | Export All (CSV/JSON) button |
| 3.4 | Weekly backup cron → JSON dump emailed to admin |
| 3.5 | Real printer integration (deployment's printer model) behind ReceiptPrinter |
| 3.6 | Demo mode banner + nightly demo reset |
| 3.7 | Card/badge payment (deferred from V1, client to opt in): "How is [teacher] paying?" screen, badge confirmation modal, admin toggle for enabled methods, later a QR "card reader" via the iPad camera |

---

## 6a. Design system (decided)

Locked via Claude Design pass 2; full spec lives in `docs/DESIGN.md`.

| Decision | Value |
|---|---|
| Direction | Warmed Shift Ledger: warm off-white base, teal primary, dark left rail with vertical steps |
| Font | Manrope 600/700/800 (distinct 1/I/l and 0/O, tabular figures). Nunito considered and rejected |
| Themes | `pocketclerk` (default) + `sample` (proof) committed; school skin = runtime CSS-var overrides, never committed |
| Type scale | One scale, all themes; change amount 184-200px is the only text at that size in the app |
| Primitives | BigButton, MoneyDisplay, NoteBanner, StepHeader, PaymentChoice, ChangeCard, Keypad/BillButtons, ShiftStats, TeacherCard, BadgeModal, Admin shell — all daisyUI-based, rules in DESIGN.md |
| Casing | Student-facing labels sentence case in every theme; `.btn` text-transform reset |

## 6. UX rules (non-negotiable, this audience is the point)

- One primary action per screen; app always advances to the next step itself.
- Touch targets ≥ 60px; text large; minimal reading.
- No free-text typing except teacher notes and email (admin can handle both).
- Change amount displayed in the largest type in the app.
- Destructive actions require confirm; students cannot reach admin or other students' data.
- "What do I do next?" must be answerable by looking at the screen.

---

## 6b. White-label configuration

The public repo never references the real school. The first deployment is private config.

| Config | Public repo default | First deployment (env/override) |
|---|---|---|
| `SCHOOL_NAME` / `PROGRAM_NAME` / `CART_NAME` | Maple Grove Learning Program / Sunrise Snack Cart | Real names |
| `REWARD_NAME` | Tickets | Blue Tickets |
| `LOGO_URL` | Text wordmark fallback | School logo URL |
| `THEME` | `pocketclerk` (default) + `sample` proof theme, both committed as daisyUI `@plugin` themes | `THEME=school`: runtime CSS-variable overrides of the default theme, values from production env/DB. Zero school bytes in git |
| Receipt/paycheck headers | From config | School header |
| Seed data | Fake teachers/students | Real data via admin |

## 7. Security & privacy

| Rule | Implementation |
|---|---|
| Student/teacher data not public | Supabase RLS; anon key scoped; admin routes behind auth |
| Students see only what the job needs | Role checks server-side, not just UI hiding |
| PINs | Hashed, rate-limited attempts |
| Real data never in repo | Seed script = fake data; `.env` for everything school-specific |
| School not googleable from repo | No school name, logo URL, or deployment mention anywhere in code, commits, or issues. Verify with `git log --all -S "<school name>"` before pushes |
| Loss protection | Export All + weekly cron backup email |

---

## 8. Portfolio plan

| Item | Detail |
|---|---|
| README | Screenshots, GIF of the order flow, architecture diagram (Excalidraw/Mermaid), provider-pattern explanation, "run locally in 3 commands" |
| Live demo | Vercel URL, Demo Mode banner, nightly reset, fake data |
| White-label proof | README shows the same screen in two themes side by side |
| CI | GitHub Actions: typecheck, lint, Vitest, Playwright; badges in README |
| Tests | Vitest on money math (totals, change, blue tickets); Playwright: clock in → order → receipt → clock out |
| ADRs | `/docs/adr/`: provider pattern, receipt queue, cents-not-floats, RLS approach, runtime theme overrides (themes as data) |
| Positioning | "White-label POS + workforce training platform; first deployment is a special-education program." Not "a coffee app for one school." |
| Resume bullet | Offline-tolerant job queue, provider abstraction, accessibility-first UI, RLS security model |

---

## 9. Build order (suggested cadence)

| When | Do |
|---|---|
| Weekend 1 | Tickets 1.1–1.8 (scaffold through order completion) |
| Weekend 2 | 1.9–1.13, deploy, hand iPad to the program admin |
| Following week | Watch/debrief one real shift; fix the surprises |
| Weekends 3–4 | V2 |
| As needed | V3; printer integration when the model arrives |

---

## 10. Open items

| Item | Owner | Blocking |
|---|---|---|
| Printer make/model | Program admin | 3.5 only (PDF print sheet covers V1) |
| Resend DNS records on pocket-clerk.com | Colin | 1.10 |
| Real teacher/student list | Program admin | Go-live only, not development |
| iPad Guided Access setup | Colin writes doc, program admin applies | Go-live |
| Pay period cadence (weekly? monthly?) | Program admin | 3.1 |
