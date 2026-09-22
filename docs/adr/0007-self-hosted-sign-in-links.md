# 7. Administrator sign-in is an emailed link, issued in-process

Status: accepted

## Context

There is one administrator. She signs in from a school laptop a handful of times
a term, to add a teacher, change a price, or check why a receipt did not arrive.

A password is the obvious answer and a bad one here. A password used four times
a year is a password that gets written down or reset every time, and a reset
flow is an emailed link with extra steps. There is also no IT desk to handle a
lockout.

The original plan called for Supabase Auth magic links. That would work, and it
brings a schema coupling (`admin_users.auth_id` joining an external identity
table), a second account to administer, and a dependency that must be configured
before the project runs at all. The project already promises that a fresh clone
runs end to end with no cloud account, which is what makes it possible to hand
someone the repository and have them see it work.

The email provider interface already exists, because receipts are emailed.

## Decision

Sign-in links are generated, hashed and redeemed in this codebase.

Requesting a link looks up the address in `admin_users`, generates 32 random
bytes, stores only an HMAC of them, and sends the link through the same
`EmailSender` the receipts use. Without a provider key that sender logs to the
console, so sign-in works on a fresh clone with nothing configured.

Redemption is a route handler, not a page. Next.js only permits setting a cookie
in an action or a route handler; a page that tried returned a 500 the first time
a link was clicked, which is how this was found.

The properties that matter:

- **Only hashes are stored.** A leaked table is not a set of working links.
  HMAC rather than a slow password hash, because the secret is 32 random bytes
  and guessing is already hopeless; the job is making a stolen database useless.
- **Single use, enforced in one statement.** The update that marks a token used
  carries `used_at IS NULL` in its predicate, so two simultaneous clicks race
  Postgres rather than the application and exactly one wins.
- **Fifteen minutes.** Long enough to walk to a laptop, short enough that a
  forwarded mail is stale.
- **No user enumeration.** The form says the same thing whether or not the
  address belongs to an administrator, so it cannot be used to discover who they
  are. Only the allowlisted address receives mail.
- **The allowlist is re-checked on redemption and on every request**, not only
  when the link was issued. Access revoked in the intervening fifteen minutes is
  actually revoked, and removing someone takes effect on their next page load
  rather than whenever their session happens to expire.
- **Rate limited** to five links per address per hour, so the form cannot be
  used to flood a mailbox.

`admin_users.auth_id` is dropped, since there is no external identity to join.

## Consequences

The project still runs with no accounts, which is the property that makes it
reviewable.

Authentication is now code in this repository, and authentication code is worth
being uncomfortable about. The mitigation is that the surface is small and each
property above is stated where it is implemented. This is a single-administrator
tool on a school network; a system with staff turnover, shared mailboxes or
compliance requirements should use a hosted provider, and the seam to do so is
one module.

The `is_admin()` function used by the RLS policies read a JWT claim that nothing
now sets, so those policies evaluate false. That is deliberate and leaves the
floor exactly where ADR 3 put it: the anonymous surface reaches nothing, and the
server remains the enforcement point for both students and administrators.
