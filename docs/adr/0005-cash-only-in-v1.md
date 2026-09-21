# 5. V1 takes cash only

Status: accepted

## Context

An early planning pass added a card payment option to the order flow: the
teacher would tap a pretend badge, and the app would record the sale with no
change to count. A payment-method screen and a badge confirmation modal were
designed and drawn before anyone checked the requirement against the client's
own written specification.

The specification is cash-only throughout. Every one of its sections that
touches payment describes the same sequence: the student states the total, the
teacher hands over pretend money, the student enters the amount received, the
app shows the change. It lists making change among the application's primary
educational purposes, alongside addition, subtraction and money recognition.
There is no card, badge or reader anywhere in it.

Worse, a pretend card payment removes the change calculation, which is the part
the program exists to teach. The feature would have made the app faster to use
and less useful.

## Decision

V1 records cash only. The payment-method screen and the badge modal are not
built. The order flow goes from the built order straight to counting change.

The schema keeps `payment_method` and the two nullable cash columns, and a
`CHECK` constraint already defines what a card order would have to look like.
Adding the feature later is a UI change and an admin toggle, not a migration.

It is recorded as ticket 3.7, explicitly conditional on the client asking for
it.

## Consequences

The one thing the program most wants students to practise happens on every
single order, rather than being skippable by choosing the faster button.

The work already done on the card screens is discarded. That is the cheaper
error: it cost a design pass, where shipping it would have cost the lesson.

The general point is the one worth keeping. The feature came from an AI planning
pass, read plausibly, and survived into a design review because it looked like
something a point-of-sale system would have. It was caught by going back to what
the client actually wrote. Requirements that nobody asked for are still
requirements that somebody has to maintain.
