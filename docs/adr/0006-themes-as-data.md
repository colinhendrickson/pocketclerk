# 6. Themes are data, and the deployment skin is not committed

Status: accepted

## Context

This repository is public. Its first deployment is a special-education program
at a K-8 school, and that school should not be identifiable from the code. Not
from a name, not from a logo URL, not from a brand palette, and not from a
commit message.

At the same time the deployed application has to look like it belongs to that
school, in the school's main color, or the staff and students will
not recognize it as theirs.

## Decision

Branding is configuration with fictional defaults. `src/lib/branding.ts` reads
the program name, cart name, reward currency and logo URL from the
environment, falling back to invented values that ship in the repository. The
reward currency is a particularly clear case: every program has its own name for
the reward, so the database column is named `reward_tickets` and the label is
config.

Themes are daisyUI themes, which under daisyUI 5 are nothing but CSS custom
properties. Two are committed: `pocketclerk`, the default, and `sample`, which
exists only to prove that the layouts name no colors. A deployment supplies its
own values for the same properties at runtime.

No component names a color. Markup uses semantic tokens only, so switching
`data-theme` is the entire re-skin.

Seed data is generated. Real teachers and students enter the system exclusively
through the admin interface on a private deployment.

## Consequences

The same build serves the public demo and the real deployment, which is the
white-label claim demonstrated rather than asserted. The `/themes` page renders
both committed themes side by side as proof.

A design document that arrived with the real school's palette in it had that
section removed before it was committed, and the contrast table lost its column.
What remains is the rule any deployment skin has to meet.

The constraint is real and ongoing. A contributor who writes `bg-blue-600`
because it is faster breaks the property silently, since the page still looks
fine in the default theme. The `sample` theme exists so that breakage is visible
in one screenshot, and `CONTRIBUTING.md` states the rule.

Verification before pushing is a grep for the school and cart names across the
repository and its history.

## Amendment: the main color is set by staff

A deployment's colors were first meant to arrive as runtime CSS variables from
the host's environment, chosen by a `NEXT_PUBLIC_THEME` variable. That variable
was read and never applied, and it would have meant a developer for every change
of color. It has been removed.

Instead, staff choose the main color on the admin Colors page, and it is stored
in the database ([ADR 11](0011-staff-chosen-main-color.md)). The property this
ADR protects is unchanged, and stronger: the school's color is in its own
database, not in git and not even in the deployment's configuration.
