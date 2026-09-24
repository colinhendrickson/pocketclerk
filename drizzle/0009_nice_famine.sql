-- Settings an administrator changes from the admin side: for now, the
-- deployment's main colour. One row, ever.
--
-- The two admin_login_tokens columns drizzle-kit also proposed here already
-- exist: 0008 added them by hand without updating the snapshot. They are left
-- out of this file; the snapshot written alongside it now records them.
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"primary_color" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_persons_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- A single row, so "the settings" is never ambiguous.
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_single_row" CHECK ("id" = 1);--> statement-breakpoint
-- A colour the stylesheet can use as it stands, or none for the theme's own.
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_primary_color_hex" CHECK (
  "primary_color" IS NULL OR "primary_color" ~ '^#[0-9a-f]{6}$'
);--> statement-breakpoint
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "admin_all_site_settings" ON "site_settings" FOR ALL
  USING ("is_admin"()) WITH CHECK ("is_admin"());--> statement-breakpoint
-- A colour is shown to everyone who opens the site; there is nothing to hide.
CREATE POLICY "read_site_settings" ON "site_settings" FOR SELECT
  USING (true);
