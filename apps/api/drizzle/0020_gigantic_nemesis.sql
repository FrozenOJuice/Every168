CREATE TABLE "edited_calendar_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"block_edits" jsonb NOT NULL,
	"before_items" jsonb NOT NULL,
	"after_items" jsonb NOT NULL,
	"item_series_states" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edited_calendar_groups" ADD CONSTRAINT "edited_calendar_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER edited_calendar_groups_revision BEFORE UPDATE ON edited_calendar_groups FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
