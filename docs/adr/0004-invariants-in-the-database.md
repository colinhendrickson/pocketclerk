# 4. Invariants live in the database, not only in TypeScript

Status: accepted

## Context

Two rules in this system are worth more than the code that usually enforces
them.

A student must not be able to clock in twice. The obvious implementation reads
the open shifts for that student, finds none, and inserts one. Two taps in quick
succession, or a retried request on flaky WiFi, produce two requests that both
read "no open shift" before either writes. Both then insert. The check passed
and the invariant broke, and no amount of care in the JavaScript prevents it,
because the gap between the read and the write is where the race lives.

An order's money must add up. A cash order needs the amount received and the
change given, the received amount must cover the total, and the change must
equal the difference. Enforcing that only in the action that writes orders means
the guarantee lasts exactly as long as that action is the only writer, which it
will not be: there will be an import script, an admin correction, a backfill, or
a second developer.

## Decision

Both rules are expressed in the schema, in a hand-written migration that sits
alongside the generated one. Drizzle owns table shape; this file owns the rules.

One open shift per student is a partial unique index:

```sql
CREATE UNIQUE INDEX one_open_shift_per_student
  ON shifts (student_id) WHERE clock_out IS NULL;
```

Order money is a `CHECK` constraint requiring that cash orders carry both money
fields, that the received amount covers the total, and that the change equals
received minus total. Card orders must carry neither field.

Both were verified by attempting the invalid writes directly against Postgres
and confirming it refused them, rather than by assuming the DDL was correct.

## Consequences

Requests can race the application. They cannot race a unique index. The double
clock-in is now impossible rather than unlikely.

The violation surfaces as a Postgres error code, which the clock-in action
catches and turns into the correct behaviour: a student who double-taps is
resumed into the shift they already have, and sees success rather than an error.
Turning the failure path into the feature is the part worth noticing.

An order whose change does not add up is unrepresentable. Not rejected by a
code path someone might forget to call: unrepresentable.

The cost is that some logic now lives in SQL, where TypeScript cannot see it,
and a developer who changes the money rules must change them in two places. The
migration comments say so explicitly for that reason.
