-- Sign-in tokens are the most sensitive table in the schema: a readable row is
-- a working sign-in link until it expires. RLS is enabled with no policy at
-- all, so nothing reaches it except the server's own connection.
--
-- This also drops `admin_users.auth_id`, which existed for Supabase Auth. Sign
-- in is handled in-process now (see docs/adr/0007-self-hosted-magic-links.md),
-- so there is no external identity to join against, and the `is_admin()`
-- function that read a JWT claim can no longer match anything.
--
-- The admin policies are left in place deliberately. With nothing setting the
-- claim they evaluate false, which means every table stays denied to the
-- anonymous surface: exactly the floor those policies were there to provide.

ALTER TABLE "admin_login_tokens" ENABLE ROW LEVEL SECURITY;
