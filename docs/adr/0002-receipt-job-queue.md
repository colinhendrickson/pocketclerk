# 2. Receipts are queued, not sent inline

Status: accepted

## Context

The cart is a rolling piece of furniture that visits classrooms on school WiFi.
Coverage is uneven, the printer runs on a battery and can be switched off or out
of paper, and there is no IT department to call when any of that goes wrong.

Completing a sale and delivering its receipt are two different operations with
very different reliability. The sale is a local database write that either
succeeds or does not. The delivery involves a printer over Bluetooth and an
email provider over the public internet, both of which fail routinely and
neither of which the student can do anything about.

If an order commits only after its receipt is delivered, a dead printer means a
lost sale, and a student standing in front of a teacher with an error message.

## Decision

Completing an order inserts the order, its line items, its add-ons and its
receipt jobs inside a single database transaction. The transaction contains no
network calls of any kind.

`receipt_jobs` rows carry a channel (`print` or `email`), a status, an attempt
counter and the last error. Consumers claim work with an atomic
`UPDATE ... SET status = 'processing' WHERE status = 'queued' RETURNING *`, so
two overlapping consumers cannot take the same job.

The two channels are consumed in different places, because the printer is
physically attached to the tablet and unreachable from a server:

- `print` jobs are claimed by the tablet, which holds the Bluetooth connection.
- `email` jobs are claimed by the server, which holds the provider credential.

A unique index on `(order_id, channel)` means an order has at most one job per
channel, which is what makes retries safe to repeat.

## Consequences

A sale never fails because of a printer. The worst outcome available to the
system is a late receipt.

Delivery is at-least-once, so duplicates are possible and consumers must be
idempotent. That is a deliberate trade: losing a receipt is worse than printing
one twice, and the unique index bounds the duplication.

Failures are visible rather than silent. A failed job keeps its error text and
attempt count, which is what the admin receipt monitor reads.

This is the Postgres-as-queue pattern, deliberately stopped at its first stage.
The scaled-up version is `SELECT ... FOR UPDATE SKIP LOCKED`, and beyond that a
real broker. Neither is justified by a single cart doing single-digit orders per
minute, and adding Redis here would be architecture for its own sake. The
upgrade path exists and has not been taken.
