# 7. Administrator sign-in is an emailed code or link, issued in-process

Status: accepted

## Context

Administrators sign in from a school laptop or phone a handful of times a term,
to add a teacher, change a price, or check why a receipt did not arrive.

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

Opening the link does not redeem it. It lands on a page with one button, and
the button's POST redeems the token. Mail security scanners, such as
Microsoft's Safe Links, which most school mail passes through, open every link
in incoming mail to inspect it; when a GET redeemed the token, the scanner's visit
spent it, and the person clicking a moment later was told the link had expired.
Scanners fetch pages and do not submit forms. It also keeps a state change off
a GET, where it did not belong. (Redemption was first a GET route handler,
because Next.js only permits setting a cookie in an action or a route handler;
a page that tried returned a 500 the first time a link was clicked.)

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

### Amendment: a six-digit code beside the link

The link assumes the person can open their email on the device they are signing
in on. On the cart's iPad that assumption is wrong in a way that matters: it is
a shared, student-facing device locked into one app, and signing a personal
mailbox into it to read one link leaves the mailbox signed in there afterwards.

So the same token row also carries a short code. The mail lands on a phone, the
six digits are typed on the iPad, and no mailbox is ever opened on it. The code
is put first in the subject line, so it is usually readable from a lock-screen
notification without opening the mail at all.

Six digits is a small secret, and the length is deliberately not the thing
defending it:

- **Scoped to one address.** A guess must be right for a specific person's
  single outstanding token, not for any live code in the table.
- **Five attempts, enforced in the claiming statement.** `attempts < 5` sits in
  the same `UPDATE` that spends the row, so parallel guesses cannot slip past a
  count read a moment earlier. The ceiling binds the correct code too, or five
  wrong guesses would buy an attacker a free sixth.
- **A malformed guess still costs an attempt.** Rejecting `12345` before the
  database would make it a free probe while a real guess costs something.
- **Newest token only.** Asking for another code retires the previous one,
  which is what someone expects after giving up on one mail.
- **Hashed with the same HMAC.** The key is `SESSION_SECRET`, which is in the
  environment and not in the table, so a stolen dump cannot grind a million
  candidates against a six-digit space.
- **Never in a URL.** The code arrives by POST to a server action. An address
  bar on a shared iPad is the last place a live secret should sit.

Digits rather than letters because the keypad is what an iPad offers and `l`
against `1` is what a transcription error looks like.

`admin_users.auth_id` is dropped, since there is no external identity to join.

## Consequences

The project still runs with no accounts, which is the property that makes it
reviewable.

The code path widens the sign-in surface from one secret to two, which is the
cost of not signing a mailbox into a device children use. Both spend the same
row, so neither outlives the other.

Authentication is now code in this repository, and authentication code is worth
being uncomfortable about. The mitigation is that the surface is small and each
property above is stated where it is implemented. This is a small-staff tool on a
school network; a system with staff turnover, shared mailboxes or
compliance requirements should use a hosted provider, and the seam to do so is
one module.

The `is_admin()` function behind the RLS admin policies now returns `false`
(migration 0010, and ADR 3's amendment). That leaves the floor exactly where
ADR 3 put it: the anonymous surface reaches nothing, and the
server remains the enforcement point for both students and administrators.

## Amendments

**Thirty-day sessions.** Staff check the cart from their own phones, and signing
in every day was the friction. Sessions last thirty days; Sign out ends one at
once, which is what a shared device calls for. Removing someone from the
allowlist still takes effect on their next request, since the allowlist is read
on every one.

**Staff manage the allowlist.** The Admins page adds and removes administrators,
so a new member of staff is not a request to the developer. Nobody can remove
themselves, and the last administrator can never be removed; the count and the
delete run under a lock on every admin row, so two administrators removing each
other at once cannot leave none. `pnpm admin:add` remains for the very first.

**An owner.** One admin is the owner (`admin_users.is_owner`, at most one by a
partial unique index). Only the owner gives and removes access, and nobody can
remove the owner, so staff cannot lock out the person responsible for the cart.
The owner can hand the role to another admin. A deployment's first admin is its
owner; where no owner exists, any admin may manage access as before.
