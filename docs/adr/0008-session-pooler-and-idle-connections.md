# 8. The session pooler, and closing idle connections before a suspend

Status: accepted (ticket 4.1)

## Context

The first real deployment hung. An administrator tapped through the admin pages
on a phone and every page spun for five minutes, until Vercel killed the request
at its 300-second limit. Nothing was logged. The health check, which also queries
the database, kept answering in a second throughout.

Two theories were tried before the cause was found, and both are recorded here
because the wrong one is still in the code, for a different reason.

**The first theory: suspended instances.** Vercel suspends a function instance
between requests, and a suspended process runs no timers. The client's idle
timeout therefore cannot close a quiet connection; the pooler drops it while the
instance sleeps, and the next request writes to a dead socket. This is real,
documented by Vercel, and a fix was shipped. The pages still hung.

**The evidence.** Reading `pg_stat_activity` while a page hung showed the admin
lookup query "active", waiting on `ClientRead`, inside a transaction opened
minutes earlier. The database had received the start of the query and was
waiting for the rest.

With prepared statements off, which Supabase's transaction pooler requires,
postgres.js sends any query with parameters in two round trips: Parse and
Describe with a Flush, then, when the parameter types come back, Bind, Execute
and Sync. The transaction pooler (Supavisor, port 6543) lost the second half.
The health check's queries have no parameters and go out in one round trip,
which is why it never hung; a signed-out page skips the parameterised admin
lookup, which is why the same page loaded signed out and hung signed in.

None of it reproduced locally: not against Postgres directly, not with bursts of
concurrent and cancelled requests, and not behind PgBouncer in transaction mode
with 15ms of network delay added. A wire-level count of protocol messages is what
showed the two-step exchange.

## Decision

Connect through the same pooler's session mode (port 5432, same host and
credentials). A client keeps one database connection for as long as it is
connected, so a two-part query cannot be split. The URL rewrite from 6543 to
5432 happens in code (`sessionPoolerUrl` in `src/db/index.ts`), so the string
Supabase and Vercel hand out keeps working as pasted.

Each instance holds at most one connection and closes it after five idle
seconds. The keep-awake hold from the first theory stays: using the database
hands `waitUntil` a promise that outlasts the idle timeout, so the connection is
closed while the instance is still running. It is the mechanism of Vercel's
`attachDatabasePool`, which does not support postgres.js.

## Consequences

Session mode spends a pooler connection per client, where transaction mode shares
them. At one connection per instance, released after five idle seconds, a school
cart is nowhere near the limit. A deployment at scale would revisit this: either
a driver that sends each query in one round trip (node-postgres does), or
prepared statements with a pooler that supports them.

The general lesson is in the order things were done. Two fixes went out on
reasoning before anyone looked at the database while it was stuck; the third
looked first, and was right.
