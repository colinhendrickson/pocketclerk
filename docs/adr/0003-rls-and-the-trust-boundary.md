# 3. Row Level Security is the floor, not the student authorization layer

Status: accepted

## Context

This application holds children's names, their working hours, and staff email
addresses. It is deployed by a program with no IT staff, on a device that sits
unattended on a cart in a school corridor.

Supabase's anonymous key is shipped to the browser by design. That is only safe
if the database itself refuses unauthorized reads, rather than relying on the
key being secret.

The complication is that students have no database identity. They sign in by
tapping a name and entering a four-digit PIN. There is no Supabase auth user
behind that, deliberately: accounts mean email addresses, passwords and reset
flows, which is friction this audience cannot absorb. So Postgres has no way to
evaluate "is this the student whose shift this is?", because from its
perspective there is no authenticated principal at all.

## Decision

Two layers, with the boundary drawn explicitly.

Row Level Security is enabled on all eleven tables. The only permissive policies
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
