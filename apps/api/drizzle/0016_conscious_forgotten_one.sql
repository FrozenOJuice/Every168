CREATE TABLE "deleted_calendar_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"block_undo_ids" jsonb NOT NULL,
	"items" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deleted_calendar_groups" ADD CONSTRAINT "deleted_calendar_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;