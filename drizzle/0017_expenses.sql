CREATE TYPE "public"."expense_category" AS ENUM('product', 'supplies', 'equipment', 'treat', 'other');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"description" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_active_idx" ON "expenses" USING btree ("active","spent_on");--> statement-breakpoint
-- An expense of nothing is a mistake, not a record. Refunds are not expenses:
-- take the entry off instead.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_check" CHECK ("amount_cents" > 0);--> statement-breakpoint
-- Staff-only data, like every other table: no policy for students at all.
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "admin_all_expenses" ON "expenses" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());
