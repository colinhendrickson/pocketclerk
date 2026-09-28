ALTER TABLE "admin_users" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- At most one owner: the admin who gives and removes access.
CREATE UNIQUE INDEX "admin_users_one_owner" ON "admin_users" ("is_owner") WHERE "is_owner";--> statement-breakpoint
-- Existing deployments: the longest-serving admin becomes the owner.
UPDATE "admin_users" SET "is_owner" = true
  WHERE "person_id" = (SELECT "person_id" FROM "admin_users" ORDER BY "created_at" LIMIT 1);
