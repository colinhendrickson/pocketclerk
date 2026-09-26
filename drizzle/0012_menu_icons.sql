ALTER TABLE "addons" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "icon" text;--> statement-breakpoint
-- Pictures come from the fixed set in src/lib/menu-icons.ts. A key added there
-- needs a new migration widening these; tests/menu-icons.test.ts compares them.
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_icon_check" CHECK ("icon" IS NULL OR "icon" IN ('mug', 'decaf', 'tea', 'cold-drink', 'water', 'milk', 'no-dairy', 'cream', 'sugar', 'syrup', 'ice', 'hot', 'lemon', 'cookie', 'donut', 'cake', 'pastry', 'fruit', 'candy', 'popcorn'));--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_icon_check" CHECK ("icon" IS NULL OR "icon" IN ('mug', 'decaf', 'tea', 'cold-drink', 'water', 'milk', 'no-dairy', 'cream', 'sugar', 'syrup', 'ice', 'hot', 'lemon', 'cookie', 'donut', 'cake', 'pastry', 'fruit', 'candy', 'popcorn'));
