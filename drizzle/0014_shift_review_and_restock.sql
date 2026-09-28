ALTER TABLE "shifts" ADD COLUMN "auto_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- A count may exceed the starting amount: the difference is stock added since
-- the last count. Usage is max(0, starting - remaining), so it is never negative.
ALTER TABLE "inventory_counts" DROP CONSTRAINT "inventory_counts_range_check";--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_range_check" CHECK (
  "starting" >= 0 AND ("remaining" IS NULL OR "remaining" >= 0)
);
