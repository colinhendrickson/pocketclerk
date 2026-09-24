# 13. Every outside effect goes through a provider

Status: accepted (tickets 1.8–1.10, 3.5)

## Context

The cart prints receipts and sends email. The printer model was unknown when the
code was written, email needs an account the public demo should not have, and a
school might one day want its own mail server. Each of those, handled inline,
would put a vendor's API into the code that takes an order.

## Decision

Every effect sits behind a small interface in `src/providers/`, and the rest of
the app calls only the interface:

- `ReceiptPrinter`: `WebBluetoothPrinter` on the cart, `ConsolePrinter` in
  development ([ADR 9](0009-receipts-over-web-bluetooth.md)).
- `EmailSender`: `ResendSender` when an API key is set, `ConsoleSender` otherwise,
  which logs the message. `getEmailSender()` chooses.
- Renderers are pure functions (`renderReceiptText`, `renderSignInEmail`), so
  what a receipt says is tested without a printer or an inbox.

Delivery is decoupled from the sale by the receipt queue
([ADR 2](0002-receipt-job-queue.md)): completing an order writes a job and
returns.

## Consequences

The app runs end to end with no accounts at all, which is how CI and a new
contributor run it. Changing printers, which has already happened once, did not
touch the order code.

An interface is a promise to keep. The email interface had no idempotency key
until a retried job could send twice; the key was added to the interface, not
worked around in the Resend sender.
