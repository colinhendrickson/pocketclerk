# PocketClerk — Design System (white-label)

Layouts are theme-agnostic. Every screen uses daisyUI semantic tokens only (`primary`, `base-*`, `neutral`, `success`, …) and theme-owned radii (`--radius-field`, `--radius-box`). Swapping `data-theme` is the entire re-skin. Branding strings come from config: `{PROGRAM_NAME}`, `{CART_NAME}`, `{REWARD_NAME}` (e.g. "Blue tickets").

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

/* Proof theme — plum / rose-grey */
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

**Deployment skins are not committed.** A real deployment sets `THEME=school` and supplies its own values for the same custom properties above (colours, radii, font) at runtime from private environment config. daisyUI 5 themes are plain CSS custom properties, so an override skin needs no code and no CSS in this repo. A skin may also swap the font family; if it uses a wider face, expect stat and menu labels to wrap one breakpoint earlier.

### Contrast (WCAG AA, checked)
| Pair | pocketclerk | sample |
|---|---|---|
| primary button text (white on primary) | 5.7:1 | 8.0:1 |
| body text (base-content on base-100) | 14.5:1 | 15.2:1 |
| secondary text (secondary on base-100) | 6.6:1 | 7.2:1 |
| accent-content on accent | 4.9:1 | 5.6:1 |
| neutral rail text (neutral-content on neutral) | 13.8:1 | 14.1:1 |

All ≥ 4.5:1. Any deployment skin must clear the same bar: 4.5:1 for every pair above, and at minimum 3:1 for primary button text since it is always 20px+/700.

---

## 2. Typography

| Theme | Family | Why |
|---|---|---|
| pocketclerk | **Manrope** 600/700/800 | Geometric but soft; tabular figures; distinct 1/I/l and 0/O for emerging readers. |
| sample | Manrope | Proves the type is product-level, not theme-level. Themes may override. |
| (comparison) | Nunito 700/800/900 | Rounder, friendlier; reads slightly younger. Shown in 2d for a decision, not mixed in. |

Type scale (px / weight / use) — one scale, all themes:
- 184–200 / 800 — **Change amount** (only place this size exists)
- 104 / 800 — Total on the payment screen
- 64–72 / 800 — Running total (order builder), "Paid by card"
- 44–48 / 800 — Screen question / welcome headline
- 34 / 800 — Primary BigButton label
- 26 / 800 — Screen title in StepHeader, menu item names
- 22–24 / 800 — Secondary BigButton labels, NoteBanner text, list rows
- 18–20 / 700 — Body, stat titles, helper lines
- 15 / 700 — "Step n of 4", captions (never below 15 on student screens)

Numerals: `font-variant-numeric: tabular-nums` on every money and time value.

---

## 3. Breakpoint behaviour per screen

Breakpoints (Tailwind defaults): `<md` phone portrait (≤ 767), `md–lg` iPad portrait, `lg+` iPad landscape / desktop (design target), `xl+` desktop admin.

**Employee dashboard**
- lg+: `grid-cols-[280px_1fr]`; dark rail with `steps steps-vertical`; stats as one horizontal `stats`; 2×2 secondary grid under the primary BigButton.
- md: rail collapses to a top bar (`navbar` on `bg-neutral`) with `steps` horizontal; stats stay horizontal; secondary grid 2×2.
- <md: top bar keeps name + avatar only; steps become a single text line "Step 2 of 4 · Take orders"; `stats` remain one row (3 compact stats, 22px values); all five buttons stack full-width, 64px tall, icon-left; Clock out pinned to bottom with `mt-auto`.

**Order builder**
- lg+: `grid-cols-[1fr_400px]`; menu 2×2 tiles; add-ons as a `btn` row; order summary is a sticky right `aside` with total + Go to payment.
- md: same two columns with the aside at 340px; menu tiles become horizontal rows (icon · name · price · qty badge).
- <md: single column. StepHeader compresses to back button + "Step 2 of 4 / Mrs. Smith · Rm 114"; NoteBanner stays directly under it (never hidden, never collapsed); menu = full-width 64px rows; add-ons wrap (`flex-wrap`, 60px pills); order summary becomes a fixed bottom sheet (`bg-base-100`, top border) showing the item line, total at 52px and the 72px primary button. No horizontal scroll at any width.

**Payment method**
- All widths: centred stack — question, Total, two `PaymentChoice` buttons. lg+: two columns 250px tall; <md: stack vertically, each 160px tall, full width. Nothing else is ever added to this screen.

**Cash change**
- lg+: `grid-cols-[1fr_420px]`; left = owed/received `table`, change card, primary; right = bill quick-buttons row + 3×4 keypad.
- md: keypad column narrows to 360px; change type drops to 150px.
- <md: single column in this order — owed/received table → **change card** (still the largest text on screen, 120px) → denomination hint → bill quick-buttons → keypad (3 cols, 64px keys) → primary button. The change card is above the keypad so the answer is visible while the student is still tapping.

**Card confirmation (modal)**
- lg+: `modal-box` 760px; <md: `modal-bottom` full-width sheet; both keep the "Type badge number instead" fallback as a full-width secondary button.

**Admin area** (denser, secondary audience)
- xl+: persistent `drawer drawer-open` sidebar + `table` views.
- <xl: `drawer` closed by default with a hamburger in the `navbar`; tables switch to `table-xs` with horizontal scroll allowed (admin only).

---

## 4. daisyUI component → primitive map

| Primitive | daisyUI base | Fixed rules | Theme-driven |
|---|---|---|---|
| **BigButton** | `btn` (+ `btn-primary` for the one primary; plain `btn bg-base-100 border-base-300` for secondary; `btn btn-outline btn-secondary` for Clock out) | `min-h-[60px]`, icon left (Lucide 34–56px), `justify-start` for list style, `flex-col` for tile style, sentence case | colour, `--radius-field` (standard height) or `--radius-box` (tiles ≥ 110px tall, so pill themes don't produce capsules), font |
| **MoneyDisplay** | plain text inside `stat-value` / `card` / `table td` | `tabular-nums`, weight 800, sizes from the scale; `size="change"` is only allowed once in the app | colour via `base-content` or `neutral-content` |
| **NoteBanner** | `alert alert-warning` with `role="alert"` | Lucide `triangle-alert` 32px, 22px/800 text, always directly under the StepHeader, never collapsible | warning colour, `--radius-box` |
| **StepHeader** | `navbar`-style bar on `bg-base-100 border-b border-base-300` + `steps` (`steps-vertical` in the rail on lg+) | back `btn btn-ghost` 60×60, "Step n of 4" (15px) over the title (26px); `steps` collapse to that text line <md | `step-primary` colour, font |
| **PaymentChoice** | `btn` tile, `bg-base-100 border-2 border-base-300` | exactly two, equal width, 250px tall (160px <md), Lucide `banknote` (success) / `id-card` (info) 80px, 40px/800 label | colours, `--radius-box` |
| **ChangeCard** | `card bg-neutral text-neutral-content` | MoneyDisplay size="change", denomination hint line beneath ("3 one-dollar bills") | neutral colours, `--radius-box` |
| **Keypad / BillButtons** | `btn` grid (`grid-cols-3` / `grid-cols-4`) | 60px minimum keys, 34px numerals; bill buttons `btn-outline btn-secondary`, selected → `btn-secondary` | colours, `--radius-field` |
| **ShiftStats** | `stats` → `stat` / `stat-title` / `stat-value` | `tabular-nums`; 3 stats max on student screens | `bg-base-100 border-base-300` |
| **TeacherCard** | `card card-border` + `avatar avatar-placeholder` | initials disc 52–60px, name 22–26px, room below | colours, radius |
| **BadgeModal** | `modal modal-open` → `modal-box` | dashed `info` ring around `id-card`, Total, Back + "Type badge number instead" | colours, `--radius-box` |
| **Admin shell** | `drawer` + `navbar` + `table` | denser type allowed (14px min) | all |
