# 11. Staff choose the main color, and cannot choose an unreadable one

Status: accepted (ticket 4.7)

## Context

The program's staff asked for the site in the school's blue. The school's colors
cannot be committed ([ADR 6](0006-themes-as-data.md)), and a variable in the
host's environment would make every change a request to the developer.

The students using the cart read every button, and some of them read with
difficulty. A color picker that allows a light blue would let a well-meant choice
make the cart harder to use, and the app is tested against WCAG 2.2 AA.

## Decision

The main color is a setting, stored in a single-row `site_settings` table and
chosen on the admin Colors page: ready-made blues, or an exact color by picker or
code. The admin and student layouts apply it by overriding the theme's
`--color-primary` and `--color-primary-content`; daisyUI derives hover and focus
shades from those at runtime.

A color is accepted only if it reaches 4.5:1 against both page backgrounds, and
the text on it, white or near-black, whichever reads better, reaches 4.5:1 on it.
The page shows the result in words as the color changes and offers a darker shade
of the same hue that passes; the server applies the same rule before saving
(`src/lib/colors.ts`, pure functions with tests). The database allows only a
`#rrggbb` value or none, and one row.

Only the main color changes. Backgrounds, text and the dark rail stay as the theme
has them, which keeps the number of combinations that must stay readable small
enough to guarantee.

## Consequences

Staff set the school's color themselves, the repo never sees it, and no choice
can break the contrast the accessibility tests hold the app to.

The color is read from the database on every admin and student page. It is read
in those layouts, not the root one, so no static page and no `next build` needs a
database, and a failed read falls back to the default rather than failing the
page.

The favicon and home-screen icons are built ahead of time and keep the default
teal.
