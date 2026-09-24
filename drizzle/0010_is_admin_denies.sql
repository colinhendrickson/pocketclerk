-- is_admin() now plainly returns false.
--
-- The admin policies from 0001 call is_admin(), which matched a Supabase Auth
-- identity in admin_users.auth_id. 0006 dropped that column when sign-in moved
-- in-process (docs/adr/0007-self-hosted-sign-in-links.md; 0006 names the file
-- by an older title) and said the function would "evaluate false". It did not:
-- a SQL function's body is not tied to the columns it reads, so it began to
-- fail with "column a.auth_id does not exist" instead. Every policy still denied,
-- so nothing was exposed, but by erroring rather than by rule.
--
-- The server reaches the database as the table owner, which RLS does not apply
-- to, and no client key is shipped, so no role is an administrator at the
-- database level. Saying so explicitly keeps the admin policies as a floor that
-- denies, instead of one that happens to throw. See docs/adr/0003.
CREATE OR REPLACE FUNCTION "is_admin"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT false;
$$;
