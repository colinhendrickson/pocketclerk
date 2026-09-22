CREATE TABLE "admin_login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_login_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "admin_users" DROP CONSTRAINT "admin_users_auth_id_unique";--> statement-breakpoint
ALTER TABLE "admin_login_tokens" ADD CONSTRAINT "admin_login_tokens_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_login_tokens_person_idx" ON "admin_login_tokens" USING btree ("person_id","created_at");--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "auth_id";