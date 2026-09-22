-- A sign-in code beside the sign-in link.
--
-- The link assumes the person can open their email on the device they want to
-- sign in on. On the cart's iPad that is exactly what should not happen: it is
-- a shared, student-facing device locked into one app, and signing a personal
-- mailbox into it to read one link leaves the mailbox there afterwards.
--
-- So the same token row now carries a short code as well. The mail arrives on a
-- phone, the code is typed on the iPad, and no mailbox is ever opened there.
-- Both halves redeem the same row, so a code cannot outlive its link.
--
-- `attempts` is what makes a six-digit secret defensible. The code is scoped to
-- one address and one fifteen-minute row, and the count is enforced in the
-- statement that redeems it, so guessing is limited to a handful of tries
-- against a single outstanding token rather than the whole keyspace.

ALTER TABLE "admin_login_tokens"
  ADD COLUMN "code_hash" text,
  ADD COLUMN "attempts" integer NOT NULL DEFAULT 0;

ALTER TABLE "admin_login_tokens"
  ADD CONSTRAINT "admin_login_tokens_attempts_check" CHECK ("attempts" >= 0);
