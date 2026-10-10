CREATE TABLE "deleted_time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL,
	"linked_entries" jsonb NOT NULL,
	"series_version" integer
);
--> statement-breakpoint
ALTER TABLE "deleted_time_blocks" ADD CONSTRAINT "deleted_time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;