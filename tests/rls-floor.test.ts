import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";

/**
 * The RLS floor (ADR 3) after 0019: nothing in the public schema is a
 * SECURITY DEFINER function any role can call, is_admin() is not executable by
 * PUBLIC, and the server-only token table carries an explicit deny.
 *
 * CI's Postgres has no Supabase anon/authenticated roles, so the role-specific
 * grants and policy scoping are proven against the Supabase databases with the
 * security advisor when the migration is applied; what is checked here is what
 * holds on every database.
 */

afterAll(async () => {
  await getClient().end();
});

describe("the RLS floor", () => {
  it("is_admin() runs as the caller and still denies", async () => {
    const [fn] = await db.execute<{ definer: boolean; result: boolean }>(sql`
      SELECT p.prosecdef AS definer, public.is_admin() AS result
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin'`);
    expect(fn).toEqual({ definer: false, result: false });
  });

  it("PUBLIC cannot execute is_admin()", async () => {
    const [grant] = await db.execute<{ public_can: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace,
        LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE n.nspname = 'public' AND p.proname = 'is_admin'
          AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
      ) AS public_can`);
    expect(grant.public_can).toBe(false);
  });

  it("admin_login_tokens has an explicit restrictive deny", async () => {
    const policies = await db.execute<{ policyname: string; permissive: string; qual: string }>(sql`
      SELECT policyname, permissive, qual FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_login_tokens'`);
    expect(policies).toEqual([
      { policyname: "deny_all_admin_login_tokens", permissive: "RESTRICTIVE", qual: "false" },
    ]);
  });
});
