-- Invariants the application was checking on its own.
--
-- The admin pages guarded against duplicate names and against a second special
-- treat with application-level lookups. That is precisely the pattern ADR 4
-- argues against: a check and a write with a gap between them, which two
-- concurrent requests can both pass. These move the rules into the database,
-- where they cannot be raced or bypassed.

--> statement-breakpoint
-- Names are unique among ACTIVE rows only. Soft deletes are how this system
-- retires records, so a retired "Maya" must not stop a new student from being
-- called Maya. Case-insensitive, because "maya" and "Maya" are the same person
-- to everyone except a byte comparison.
CREATE UNIQUE INDEX "students_active_name_key"
  ON "students" (lower("display_name")) WHERE "active";

--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_active_name_key"
  ON "menu_items" (lower("name")) WHERE "active";

--> statement-breakpoint
CREATE UNIQUE INDEX "addons_active_name_key"
  ON "addons" (lower("name")) WHERE "active";

--> statement-breakpoint
-- At most one special treat at a time.
--
-- "Today's special treat" is singular in the client's specification, and a
-- schema that permits two of them invites a screen that has to decide which one
-- wins. Indexing the flag only where it is true means a second special is
-- rejected rather than silently accepted.
CREATE UNIQUE INDEX "menu_items_single_special_key"
  ON "menu_items" (("is_special")) WHERE "is_special";
