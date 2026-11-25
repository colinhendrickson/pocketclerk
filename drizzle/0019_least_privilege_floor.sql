-- Least privilege on the RLS floor (ADR 3), from the 2026-11-22 security sweep.
--
-- Supabase's security advisor flagged two SECURITY DEFINER functions that any
-- caller, signed in or not, could run through the Data API (/rest/v1/rpc/...),
-- and admin policies written for every role. Nothing was exposed: is_admin()
-- has returned false since 0010 and the server reaches Postgres as the table
-- owner, which RLS does not apply to. This narrows the surface so the floor is
-- denied by rule and by grant, not only by a function's body.
--
-- Each block checks that a Supabase role exists, so the same file applies to the
-- plain Postgres used locally and in CI, where anon and authenticated do not.

-- 1. The admin_all_* policies apply only to signed-in callers. An anonymous
--    caller now matches no permissive policy at all (except the public reads of
--    active menu items and add-ons, which stay as they are) and is denied
--    without evaluating is_admin().
DO $$
DECLARE p record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOR p IN
      SELECT schemaname, tablename, policyname FROM pg_policies
      WHERE schemaname = 'public' AND policyname LIKE 'admin\_all\_%'
    LOOP
      EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                     p.policyname, p.schemaname, p.tablename);
    END LOOP;
  END IF;
END $$;--> statement-breakpoint

-- 2. is_admin() reads nothing since 0010, so it no longer needs to run as its
--    owner. SECURITY INVOKER removes the definer surface; EXECUTE is taken from
--    PUBLIC and anon and given back only to authenticated, the one role whose
--    policies (above) still call it.
CREATE OR REPLACE FUNCTION "is_admin"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public, pg_temp
AS $$
  SELECT false;
$$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "is_admin"() FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
  END IF;
END $$;--> statement-breakpoint

-- 3. rls_auto_enable() is the event-trigger function behind Supabase's
--    "enable RLS automatically" option. It exists only where that option was
--    turned on. Event triggers fire without an EXECUTE check, so nobody needs to
--    call it directly; take EXECUTE from every API role.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
  END IF;
END $$;--> statement-breakpoint

-- 4. admin_login_tokens is server-only and already denied to every API role by
--    RLS with no policy. Say so with an explicit policy, so the intent is
--    written down and the advisor's "RLS enabled, no policy" note is answered.
DROP POLICY IF EXISTS "deny_all_admin_login_tokens" ON "admin_login_tokens";--> statement-breakpoint
CREATE POLICY "deny_all_admin_login_tokens" ON "admin_login_tokens"
  AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
