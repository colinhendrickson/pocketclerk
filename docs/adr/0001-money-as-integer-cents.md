# 1. Money is integer cents, everywhere

Status: accepted

## Context

The cart teaches students to take payment and count change. A wrong total or a
wrong change figure does not merely produce a bad row in a table; it teaches a
student that an incorrect answer is correct, in front of a customer, and the
student has no way to know.

Binary floating point cannot represent a tenth exactly. `0.1 + 0.2` evaluates to
`0.30000000000000004`, and errors of that shape accumulate through sums and
subtractions. A `numeric` column in Postgres avoids the drift but reintroduces
it as soon as a value is read into a JavaScript number, which is the only way
the application ever handles it.

## Decision

Every monetary value is an integer number of cents, from the database column to
the server action to the component prop. Columns are suffixed `_cents`. There is
no `numeric`, `real` or `double precision` column anywhere in the schema, and no
money value is ever a JavaScript float.

The same reasoning is applied to time: shift length is stored as integer
hundredths of an hour rather than a fractional number of hours.

Formatting happens at one place, `formatUSD` in `src/lib/money.ts`, called only
from components. Nothing in `src/lib` or `src/db` produces a formatted string,
so there is no path by which a display concern can leak into a calculation.

## Consequences

Arithmetic is exact. Totals, change and denomination breakdowns are integer
operations with no rounding step and no tolerance comparisons in the tests.

The money module is pure: it imports neither the database nor React, so its 32
tests run with no mocks and no fixtures.

The cost is a discipline that has to be maintained. A contributor who writes
`price * 1.08` for a future tax feature reintroduces the problem, which is why
the rule is stated in `CLAUDE.md` and enforced by the column naming convention
being uniform enough that a violation is visible in review.

Database `CHECK` constraints reject negative money, so the invariant holds even
against a client that is not this application.
