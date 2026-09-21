-- Database law: invariants and authorization that the ORM does not express.
--
-- Drizzle owns table shape. This file owns the rules that must hold no matter
-- which client is connected — the app, a future import script, an admin poking
-- at SQL, or a bug. Every constraint here exists because the application layer
-- is not the only writer, and never will be.

--> statement-breakpoint
-- A student may have at most one open shift.
--
-- This is the fix for double clock-in, and it is an index rather than an `if`
-- on purpose. Two concurrent requests can both read "no open shift" and both
-- proceed; they cannot both satisfy a unique index. Requests race the API, they
-- cannot race Postgres. The application catches the resulting unique violation
-- and treats it as "you are already clocked in", turning an error path into UX.
CREATE UNIQUE INDEX "one_open_shift_per_student"
  ON "shifts" ("student_id")
  WHERE "clock_out" IS NULL;

--> statement-breakpoint
-- A closed shift has both derived values; an open shift has neither. This keeps
-- a half-finished clock-out from being representable at all.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_fields_check" CHECK (
  ("clock_out" IS NULL AND "hours_hundredths" IS NULL AND "reward_tickets" IS NULL)
  OR
  ("clock_out" IS NOT NULL AND "hours_hundredths" IS NOT NULL AND "reward_tickets" IS NOT NULL)
);

--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ordered_check"
  CHECK ("clock_out" IS NULL OR "clock_out" >= "clock_in");

--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_nonnegative_check"
  CHECK (
    ("hours_hundredths" IS NULL OR "hours_hundredths" >= 0)
    AND ("reward_tickets" IS NULL OR "reward_tickets" >= 0)
  );

--> statement-breakpoint
-- Cash orders carry the money fields and must cover the total. Card orders
-- carry neither. An order that violates the payment rules is unrepresentable
-- rather than merely rejected by a code path someone might forget to call.
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_fields_check" CHECK (
  (
    "payment_method" = 'cash'
    AND "received_cents" IS NOT NULL
    AND "change_cents" IS NOT NULL
    AND "received_cents" >= "total_cents"
    AND "change_cents" = "received_cents" - "total_cents"
  )
  OR
  (
    "payment_method" = 'card'
    AND "received_cents" IS NULL
    AND "change_cents" IS NULL
  )
);

--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_nonnegative_check"
  CHECK ("total_cents" >= 0);

--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_positive_check"
  CHECK ("qty" > 0 AND "unit_price_cents" >= 0);

--> statement-breakpoint
ALTER TABLE "order_item_addons" ADD CONSTRAINT "order_item_addons_price_check"
  CHECK ("price_cents" >= 0);

--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_price_check"
  CHECK ("price_cents" >= 0);

--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_price_check"
  CHECK ("price_cents" >= 0);

--> statement-breakpoint
ALTER TABLE "receipt_jobs" ADD CONSTRAINT "receipt_jobs_attempts_check"
  CHECK ("attempts" >= 0);

--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- The trust boundary, stated plainly, because this is the part most worth
-- understanding:
--
-- Students have no auth identity. They sign in with a name tap and a PIN, which
-- Postgres cannot verify, so RLS cannot express "this student may read this
-- shift". The server can, and does, using the service-role connection plus its
-- own checks against the signed session cookie.
--
-- So RLS is not the student authorization layer. It is the floor under the
-- public surface: the anon key that ships to the browser can reach nothing at
-- all, and an authenticated admin can reach only what the allowlist permits.
-- Even a bug in an API route cannot leak a table to an anonymous caller,
-- because Postgres itself refuses.
--
-- Enabling RLS with no permissive policy denies everything by default, which is
-- exactly what is wanted for every table a student touches.

ALTER TABLE "persons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_item_addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receipt_jobs" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- Is the current authenticated caller on the admin allowlist?
--
-- SECURITY DEFINER so the lookup itself is not subject to the policy it backs,
-- which would otherwise recurse. Search path is pinned because a SECURITY
-- DEFINER function with a mutable search path is a privilege escalation.
CREATE OR REPLACE FUNCTION "is_admin"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "admin_users" a
    WHERE a."auth_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );
$$;

--> statement-breakpoint
-- Admins may read and write everything. No other policy exists, so every other
-- caller is denied by default on every table above.
CREATE POLICY "admin_all_persons" ON "persons" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_teacher_profiles" ON "teacher_profiles" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_admin_users" ON "admin_users" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_students" ON "students" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_shifts" ON "shifts" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_orders" ON "orders" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_order_items" ON "order_items" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_order_item_addons" ON "order_item_addons" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_receipt_jobs" ON "receipt_jobs" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());

--> statement-breakpoint
-- The menu is the one thing a student screen may read without the server
-- mediating, and it contains nothing private: names and prices of coffee.
CREATE POLICY "admin_all_menu_items" ON "menu_items" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "read_active_menu_items" ON "menu_items" FOR SELECT
  USING ("active" = true);--> statement-breakpoint
CREATE POLICY "admin_all_addons" ON "addons" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "read_active_addons" ON "addons" FOR SELECT
  USING ("active" = true);
