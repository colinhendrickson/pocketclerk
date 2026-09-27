# 3. Row Level Security is the floor, not the student authorization layer

Status: accepted

## Context

This application holds children's names, their working hours, and staff email
addresses. It is deployed by a program with no IT staff, on a device that sits
unattended on a cart in a school corridor.

Supabase publishes an anonymous key and a Data API for every project, and a
typical Supabase app ships that key to the browser. That is only safe if the
database itself refuses unauthorized reads, rather than relying on the key being
secret. PocketClerk ships no key at all and reaches Postgres only from the
server, but the Data API still exists, so the database has to hold regardless.

The complication is that students have no database identity. They sign in by
tapping a name and entering a four-digit PIN. There is no Supabase auth user
behind that, deliberately: accounts mean email addresses, passwords and reset
flows, which is friction this audience cannot absorb. So Postgres has no way to
evaluate "is this the student whose shift this is?", because from its
perspective there is no authenticated principal at all.

## Decision

Two layers, with the boundary drawn explicitly.

Row Level Security is enabled on every table, fifteen at the time of writing. The only permissive policies
are admin policies, keyed on an allowlist lookup through a `SECURITY DEFINER`
function with a pinned `search_path`, plus a public read of active menu items
and add-ons, which contain nothing but the names and prices of coffee.

Enabling RLS with no matching policy denies by default. An anonymous caller
therefore reaches nothing: not students, not shifts, not orders, not teacher
notes. That is the floor, and it holds even if a bug in an API route exposes a
query it should not have.

Student actions run on the server through the service connection, which bypasses
RLS, and the server is responsible for scoping them. It does so against the
signed, httpOnly session cookie, which holds the id of the open shift. Every
student action resolves that cookie to a shift that is still open before
touching anything, and everything a student can do is scoped to their own shift.

## Consequences

The public surface is closed regardless of application bugs, which is the
property that matters most for this data.

The server is a trusted component and must be treated as one. A missing session
check in a server action is a real vulnerability, and RLS will not catch it.
This is the cost of PIN-based sign-in, accepted knowingly rather than by
accident, and it is why the session check is the first statement of every action
rather than a wrapper someone might forget to apply.

Adding real student identities later would let RLS express student scope
directly. That is the natural upgrade if this ever runs at more than one site,
alongside an `org_id` on every policy for multi-tenancy.

## Amendments

**Admins are not a database role (migration 0010).** The admin policies call
`is_admin()`, which matched a Supabase Auth identity. When sign-in moved
in-process ([ADR 7](0007-self-hosted-sign-in-links.md)) that column was dropped,
and the function began to throw rather than return false. Access was still
denied, but by error. It now returns `false` explicitly: the server reaches the
database as the table owner, which RLS does not apply to, so no database role
is ever an administrator, and the admin policies are a floor that denies by
rule.

**Student actions also require a paired device.** Resolving the shift cookie
scopes what a student can do; [ADR 10](0010-device-pairing.md) adds that the
request must come from a paired device at all, checked in every student server
action, not only on the pages.

**One more public read.** `site_settings` holds the main color chosen on the
admin Colors page and nothing else; it has a public read policy beside the menu's
([ADR 11](0011-staff-chosen-main-color.md)).
