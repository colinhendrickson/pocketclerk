-- Two active supplies with the same name would be counted twice at the end of a
-- shift. Same rule as menu items and add-ons (migration 0007).
CREATE UNIQUE INDEX "inventory_items_active_name_key"
  ON "inventory_items" (lower("name")) WHERE "active";
