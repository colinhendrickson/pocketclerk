# PocketClerk — Design System (white-label)

Layouts are theme-agnostic. Every screen uses daisyUI semantic tokens only (`primary`, `base-*`, `neutral`, `success`, …) and theme-owned radii (`--radius-field`, `--radius-box`). Swapping `data-theme` is the entire re-skin. Branding strings come from config: `{PROGRAM_NAME}`, `{CART_NAME}`, `{REWARD_NAME}` (e.g. "Tickets").

Rules that hold in every theme
- Student-facing labels are sentence case, even if the brand style uses caps.
- One primary action per screen = the only `btn-primary` on that screen.
- Touch targets ≥ 60px at every breakpoint; no hover-only affordances; no horizontal scroll on student screens.
- Money is always `font-variant-numeric: tabular-nums`; the change amount is the largest text in the app.
- Motion only in response to a tap (daisyUI's built-in `btn` press scale; nothing ambient).

---

## 1. Themes — `globals.css` (Tailwind 4 / daisyUI 5)

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: pocketclerk --default, sample;
}

/* Default product theme — warmed Shift Ledger */
@plugin "daisyui/theme" {
  name: "pocketclerk";
  default: true;
  prefersdark: false;
  color-scheme: light;

  --color-base-100: #FFFCF7;
  --color-base-200: #F5F0E8;
  --color-base-300: #E2D9CC;
  --color-base-content: #1C2624;

  --color-primary: #0B6E5F;
  --color-primary-content: #FFFFFF;
  --color-secondary: #4A5F5A;
  --color-secondary-content: #FFFFFF;
  --color-accent: #2E5E8F;
  --color-accent-content: #FFFFFF;
  --color-neutral: #1F2E2B;
  --color-neutral-content: #F5F0E8;

  --color-info: #2E5E8F;
  --color-info-content: #FFFFFF;
  --color-success: #1F7A3E;
  --color-success-content: #FFFFFF;
  --color-warning: #B45309;
  --color-warning-content: #FFFFFF;
  --color-error: #B42318;
  --color-error-content: #FFFFFF;

  --radius-selector: 0.5rem;
  --radius-field: 0.625rem;
  --radius-box: 0.875rem;
  --size-selector: 0.3125rem;
  --size-field: 0.3125rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}

/* Proof theme — plum / rose-gray */
@plugin "daisyui/theme" {
  name: "sample";
  default: false;
  prefersdark: false;
  color-scheme: light;

  --color-base-100: #FCFAFB;
  --color-base-200: #F3EEF1;
  --color-base-300: #DCD1D8;
  --color-base-content: #24192A;

  --color-primary: #6B3A7A;
  --color-primary-content: #FFFFFF;
  --color-secondary: #5B4F60;
  --color-secondary-content: #FFFFFF;
  --color-accent: #8A5E12;
  --color-accent-content: #FFFFFF;
  --color-neutral: #2A1F30;
  --color-neutral-content: #F3EEF1;

  --color-info: #2F6F9F;
  --color-info-content: #FFFFFF;
  --color-success: #2E7D4F;
  --color-success-content: #FFFFFF;
  --color-warning: #B45309;
  --color-warning-content: #FFFFFF;
  --color-error: #B42318;
  --color-error-content: #FFFFFF;

  --radius-selector: 0.75rem;
  --radius-field: 0.875rem;
  --radius-box: 1.25rem;
  --size-selector: 0.3125rem;
  --size-field: 0.3125rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}

/* Fonts are theme-owned so the layout never names one */
[data-theme="pocketclerk"], [data-theme="sample"] { font-family: "Manrope", system-ui, sans-serif; }
.btn { text-transform: none; letter-spacing: 0; } /* sentence case everywhere, no brand override */
```

**Deployment skins are not committed.** A deployment's main color is chosen by staff on the admin Colors page and stored in its own database (see "Staff-chosen main color" below and ADR 11), so no school's palette enters git or even the deployment's configuration. The pocketclerk theme's other values (backgrounds, text, radii, font) are the same for every deployment.

### Staff-chosen main color

Staff can replace the theme's `--color-primary` from the admin Colors page (`site_settings.primary_color`, applied by `src/app/theme-color.tsx` in the admin and student layouts). Only the main color and the text on it change; `--color-primary-content` is chosen as white or near-black, whichever reads better. A color is refused unless it reaches 4.5:1 against both `base-100` and `base-200` and its button text reaches 4.5:1 on it (`src/lib/colors.ts`), so no choice can break the checks below. The icon files keep the pocketclerk teal.

### Contrast (WCAG AA, checked)
| Pair | pocketclerk | sample |
|---|---|---|
| primary button text (white on primary) | 5.7:1 | 8.0:1 |
| body text (base-content on base-100) | 14.5:1 | 15.2:1 |
| secondary text (secondary on base-100) | 6.6:1 | 7.2:1 |
| accent-content on accent | 4.9:1 | 5.6:1 |
| neutral rail text (neutral-content on neutral) | 13.8:1 | 14.1:1 |

All ≥ 4.5:1. A staff-chosen main color must clear the same bar (`src/lib/colors.ts` checks it): 4.5:1 for every pair above, and at minimum 3:1 for primary button text since it is always 20px+/700.

---

## 2. Typography

| Theme | Family | Why |
|---|---|---|
| pocketclerk | **Manrope** 600/700/800 | Geometric but soft; tabular figures; distinct 1/I/l and 0/O for emerging readers. |
| sample | Manrope | Proves the type is product-level, not theme-level. Themes may override. |

Type scale (px / weight / use) — one scale, all themes:
- 184–200 / 800 — **Change amount** (only place this size exists). 192px wherever it fits; narrower cards shrink it to exactly their width (container units, sized by the figure's own length), so it is never cut off and stays the largest text on screen
- 104 / 800 — Total on the payment screen (64 below md)
- 64–72 / 800 — Running total (order builder) (52 in the phone bottom sheet); "Paid by card" with 3.7
- 44–48 / 800 — Screen question / welcome headline
- 34 / 800 — Primary BigButton label (26 below lg, where it sits in phone widths and 340–360px tablet columns)
- 26 / 800 — Screen title in StepHeader, menu item names
- 22–24 / 800 — Secondary BigButton labels, NoteBanner text, list rows
- 18–20 / 700 — Body, stat titles, helper lines
- 15 / 700 — "Step n of 4", captions (never below 15 on student screens)

Numerals: `font-variant-numeric: tabular-nums` on every money and time value.

---

## 3. Breakpoint behavior per screen

Breakpoints (Tailwind defaults): `<md` phone portrait (≤ 767), `md–lg` iPad portrait, `lg+` iPad landscape / desktop (design target), `xl+` desktop admin.

**Employee dashboard**
- lg+: `grid-cols-[280px_1fr]`; dark rail with `steps steps-vertical`; stats as one horizontal `stats`; 2×2 secondary grid under the primary BigButton.
- md: rail collapses to a top bar (`navbar` on `bg-neutral`) with `steps` horizontal; stats stay horizontal; secondary grid 2×2.
- <md: top bar keeps name + avatar only; steps become a single text line "Step 2 of 4 · Take orders"; `stats` remain one row (3 compact stats, 22px values); all five buttons stack full-width, 64px tall, icon-left; Clock out pinned to bottom with `mt-auto`.

**Order builder**
- lg+: `grid-cols-[1fr_400px]`; menu 2×2 tiles; add-ons as a `btn` row; order summary is a sticky right `aside` with total + Go to payment.
- md: same two columns with the aside at 340px; menu tiles become horizontal rows (icon · name · price · qty badge).
- <md: single column. StepHeader compresses to back button + "Step 2 of 4 / Mrs. Smith · Rm 114"; NoteBanner stays directly under it (never hidden, never collapsed); menu = full-width 64px rows; add-ons wrap (`flex-wrap`, 60px pills); order summary becomes a fixed bottom sheet (`bg-base-100`, top border) showing the item line, total at 52px and the 72px primary button. No horizontal scroll at any width.

**Payment method** *(deferred to ticket 3.7: V1 is cash only, ADR 5; kept as the design for when the client asks)*
- All widths: centered stack — question, Total, two `PaymentChoice` buttons. lg+: two columns 250px tall; <md: stack vertically, each 160px tall, full width. Nothing else is ever added to this screen, and it has no `btn-primary`: the two choices are equal, so the one-primary rule is waived here.

**Cash change**
- lg+: `grid-cols-[1fr_420px]`; left = owed/received `table`, change card, primary; right = bill quick-buttons row + 3×4 keypad.
- md: keypad column narrows to 360px; change type drops to 150px.
- <md: single column in this order — owed/received table → **change card** (still the largest text on screen; sized to the card, about 105px on a 390px phone) → denomination hint → bill quick-buttons (2×2 wherever a row of four would not fit "$20.00") → keypad (3 cols) → primary button. The change card is above the keypad so the answer is visible while the student is still tapping.

**Card confirmation (modal)** *(deferred to ticket 3.7)*
- lg+: `modal-box` 760px; <md: `modal-bottom` full-width sheet; both keep the "Type badge number instead" fallback as a full-width secondary button.

**Admin area** (denser, secondary audience)
- xl+: persistent `drawer drawer-open` sidebar + `table` views.
- <xl: `drawer` closed by default with a hamburger in the `navbar`; the drawer closes itself after a link is tapped; tables scroll horizontally inside their card (admin only). The page itself never scrolls sideways.

`tests/e2e/responsive.spec.ts` checks every screen at 320, 390, 768, 1180 and 1440px for sideways scroll and for a change amount that fits its card.

---

## 4. daisyUI component → primitive map

| Primitive | daisyUI base | Fixed rules | Theme-driven |
|---|---|---|---|
| **BigButton** | `btn` (+ `btn-primary` for the one primary; plain `btn bg-base-100 border-base-300` for secondary; `btn btn-outline btn-secondary` for Clock out) | `min-h-[60px]`, icon left (Lucide 34–56px), `justify-start` for list style, `flex-col` for tile style, sentence case | color, `--radius-field` (standard height) or `--radius-box` (tiles ≥ 110px tall, so pill themes don't produce capsules), font |
| **MoneyDisplay** | plain text inside `stat-value` / `card` / `table td` | `tabular-nums`, weight 800, sizes from the scale; `size="change"` is only allowed once in the app | color via `base-content` or `neutral-content` |
| **NoteBanner** | `alert alert-warning` with `role="alert"` | Lucide `triangle-alert` 32px, 22px/800 text, always directly under the StepHeader, never collapsible | warning color, `--radius-box` |
| **StepHeader** | `navbar`-style bar on `bg-base-100 border-b border-base-300` + `steps` (`steps-vertical` in the rail on lg+) | back `btn btn-ghost` 60×60, "Step n of 4" (15px) over the title (26px); `steps` collapse to that text line <md | `step-primary` color, font |
| **PaymentChoice** *(3.7)* | `btn` tile, `bg-base-100 border-2 border-base-300` | exactly two, equal width, 250px tall (160px <md), Lucide `banknote` (success) / `id-card` (info) 80px, 40px/800 label | colors, `--radius-box` |
| **ChangeCard** | `card bg-neutral text-neutral-content` | MoneyDisplay size="change", denomination hint line beneath ("3 one-dollar bills") | neutral colors, `--radius-box` |
| **Keypad / BillButtons** | `btn` grid (`grid-cols-3` / `grid-cols-4`) | 60px minimum keys, 34px numerals; bill buttons `btn-outline btn-secondary`, selected → `btn-secondary` | colors, `--radius-field` |
| **ShiftStats** | `stats` → `stat` / `stat-title` / `stat-value` | `tabular-nums`; 3 stats max on student screens | `bg-base-100 border-base-300` |
| **TeacherCard** | `card card-border` + `avatar avatar-placeholder` | initials disc 52–60px, name 22–26px, room below | colors, radius |
| **StaffCardCheck** *(3.7, was BadgeModal)* | a full step, not a `modal` (Back and focus behave like the other steps) | dashed `info` ring around Lucide `id-card`, "Ask {teacher} for their staff card", the Total, one primary "Card checked, done"; no typing, so no badge-number fallback | colors, `--radius-box` |
| **Admin shell** | `drawer` + `navbar` + `table` | denser type allowed (14px min) | all |
| **HelpPanel** | native `details` in a `rounded-box border` | "About this page" under every admin page's heading (not Admin home, which lists every guide); open by default, closed state remembered per device; guides inside as nested `details` | `info` icon color, `--radius-box` |
| **TourButton** | `btn btn-ghost btn-sm` + native modal `dialog` | in the admin header, labeled "Show me around" ("Tour" below sm, so the cart name keeps its room); never opens by itself; dialog docked at the bottom with a transparent backdrop, target outlined in `primary` and scrolled to the top; steps in `src/lib/help/tours.ts` against `data-tour` attributes | `primary` outline, `--radius-box` |
| **SetupChecklist** | `progress` + `ol` of step cards | Admin home only; state read from data, never stored; folds to one line when every required step is done | `success` / `info` |
| **MenuIcon** | Lucide line icon, `aria-hidden` | an optional picture beside a menu item (44px) or inside an add-on button (26px), from the fixed set in `src/lib/menu-icons.ts` (decaf is Lucide's mug with a D); never emoji, which differ by device | `primary` on items, current color in add-on buttons |
| **DemoBanner** | `bg-neutral text-neutral-content` bar + `btn btn-outline` | the public demo only, on every page including the landing page, above everything but the skip link; `role="region"` labeled "Demo"; 18px/700 "This is a demo. Everything resets every hour."; **Start over** 60px tall, never `btn-primary` | `neutral` |
| **Logo** | inline `svg`, drawing in `src/lib/logo.ts` | the PocketClerk mark (a "P" on a torn receipt), the same on every deployment; decorative (`aria-hidden`) because it always sits beside a name; 28px in the admin header, 72px on the student sign-in and not-set-up screens | `fill-primary` / `fill-base-100`, so it follows the theme. The icon files (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icon-*.png`) use the pocketclerk theme's literal colors and are rendered by `scripts/render-icons.ts`; never edit them by hand |
