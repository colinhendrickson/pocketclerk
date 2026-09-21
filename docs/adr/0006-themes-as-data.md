# 6. Themes are data, and the deployment skin is not committed

Status: accepted

## Context

This repository is public. Its first deployment is a special-education program
at a K-8 school, and that school should not be identifiable from the code. Not
from a name, not from a logo URL, not from a brand palette, and not from a
commit message.

At the same time the deployed application has to look like it belongs to that
school, in that school's colours and typeface, or the staff and students will
not recognise it as theirs.

## Decision

Branding is configuration with fictional defaults. `src/lib/branding.ts` reads
the program name, cart name, reward currency, logo URL and theme from the
environment, falling back to invented values that ship in the repository. The
reward currency is a particularly clear case: the first deployment calls them
"Blue Tickets", so the database column is named `reward_tickets` and the label
is config.

Themes are daisyUI themes, which under daisyUI 5 are nothing but CSS custom
properties. Two are committed: `pocketclerk`, the default, and `sample`, which
exists only to prove that the layouts name no colours. A deployment supplies its
own values for the same properties at runtime.

No component names a colour. Markup uses semantic tokens only, so switching
`data-theme` is the entire re-skin.

Seed data is generated. Real teachers and students enter the system exclusively
through the admin interface on a private deployment.

## Consequences

The same build serves the public demo and the real deployment, which is the
white-label claim demonstrated rather than asserted. The home page renders both
committed themes side by side as proof.

A design document that arrived with the real school's palette in it had that
section removed before it was committed, and the contrast table lost its column.
What remains is the rule any deployment skin has to meet.

The constraint is real and ongoing. A contributor who writes `bg-blue-600`
because it is faster breaks the property silently, since the page still looks
fine in the default theme. The `sample` theme exists so that breakage is visible
in one screenshot, and `CLAUDE.md` states the rule for every future session.

Verification before pushing is a grep for the school and cart names across the
repository and its history.
