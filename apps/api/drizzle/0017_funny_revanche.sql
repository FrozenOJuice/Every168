CREATE TABLE "calendar_series_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"series_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"before_blocks" jsonb NOT NULL,
	"after_blocks" jsonb NOT NULL,
	"removed_block_undo_ids" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_series_changes" ADD CONSTRAINT "calendar_series_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;