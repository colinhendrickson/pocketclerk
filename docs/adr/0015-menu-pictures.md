# 15. Pictures beside menu names, from a fixed set

Status: accepted (ticket 4.14)

## Context

The first program's teacher asked for pictures next to the drink names: some
students cannot read the menu yet, and could not find sugar or syrup. Her
examples were emoji.

## Decision

Staff can give any menu item or add-on one optional picture, chosen from a grid
on the Menu page. The pictures are a fixed set of twenty line icons
(`src/lib/menu-icons.ts`) from the same icon family as the rest of the app, not
emoji, and not uploads:

- Emoji are drawn by the device, so the same menu looks different on the iPad, a
  phone and a Windows laptop, and their colour and detail clash with the rest of
  the screen.
- Uploaded images would need storage, moderation and sizing, for a feature
  whose whole value is being simple and consistent.
- Where the icon family had nothing clear, the icon was drawn from its parts:
  decaf is the mug with a D, built with Lucide's own `createLucideIcon` so the
  line weight matches.

The column is text with a CHECK constraint listing the keys, so the database
refuses anything outside the set, and a test fails if the constraint and the
list drift apart. The icon is `aria-hidden`: the name beside it is the label.

## Consequences

- Adding a picture takes a migration that widens the constraint, as well as a
  line in the list. That is deliberate friction for a list meant to stay short.
- Some items share a picture (coffee and hot chocolate are both a mug), so the
  words still matter; the help guide says so.
