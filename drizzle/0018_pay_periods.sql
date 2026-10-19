CREATE TABLE "pay_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_id" uuid,
	"started_by" uuid
);
--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_previous_id_pay_periods_id_fk" FOREIGN KEY ("previous_id") REFERENCES "public"."pay_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_started_by_persons_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_periods_previous_idx" ON "pay_periods" USING btree ("previous_id");--> statement-breakpoint
-- Only one period may follow nothing. With the unique previous_id above, the
-- periods form one chain, so two clicks on Start new pay period make one.
CREATE UNIQUE INDEX "pay_periods_first_idx" ON "pay_periods" ((true)) WHERE "previous_id" IS NULL;--> statement-breakpoint
-- Staff-only data, like every other table: no policy for students at all.
ALTER TABLE "pay_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "admin_all_pay_periods" ON "pay_periods" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());
