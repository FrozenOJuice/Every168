CREATE TABLE "edited_time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"series_state" jsonb
);
--> statement-breakpoint
ALTER TABLE "deleted_time_blocks" ADD COLUMN "series_state" jsonb;--> statement-breakpoint
ALTER TABLE "edited_time_blocks" ADD CONSTRAINT "edited_time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deleted_time_blocks" DROP COLUMN "series_version";