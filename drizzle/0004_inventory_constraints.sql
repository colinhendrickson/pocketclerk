-- Inventory invariants and RLS for the new tables.

--> statement-breakpoint
-- A count cannot claim more left than was there to begin with, and neither
-- figure can be negative. "Used" is derived as starting minus remaining, so a
-- remaining above starting would produce negative usage in every report.
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_range_check" CHECK (
  "starting" >= 0
  AND ("remaining" IS NULL OR ("remaining" >= 0 AND "remaining" <= "starting"))
);

--> statement-breakpoint
-- A counted row records when it was counted; an uncounted one does not.
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_counted_check" CHECK (
  ("remaining" IS NULL AND "counted_at" IS NULL)
  OR ("remaining" IS NOT NULL AND "counted_at" IS NOT NULL)
);

--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_par_check"
  CHECK ("par_level" >= 0);

--> statement-breakpoint
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_counts" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "admin_all_inventory_items" ON "inventory_items" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
CREATE POLICY "admin_all_inventory_counts" ON "inventory_counts" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());
