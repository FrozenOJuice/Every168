CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"checked" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_completed_at" timestamp (3) with time zone,
	CONSTRAINT "routines_fields" CHECK ("routines"."version">0 and char_length(btrim("routines"."name")) between 1 and 160 and jsonb_typeof("routines"."steps")='array' and jsonb_array_length("routines"."steps") between 1 and 50 and cardinality("routines"."checked")<=50 and "routines"."run_count">=0)
);
--> statement-breakpoint
ALTER TABLE "calendar_template_entries" DROP CONSTRAINT "calendar_template_entry_fields";--> statement-breakpoint
ALTER TABLE "calendar_templates" DROP CONSTRAINT "calendar_template_fields";--> statement-breakpoint
ALTER TABLE "calendar_templates" ADD COLUMN "range_days" integer;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routines_owner_created_idx" ON "routines" USING btree ("user_id","created_at","id");--> statement-breakpoint
ALTER TABLE "calendar_template_entries" ADD CONSTRAINT "calendar_template_entry_fields" CHECK ("calendar_template_entries"."version">0 and isfinite("calendar_template_entries"."created_at") and isfinite("calendar_template_entries"."updated_at") and char_length(btrim("calendar_template_entries"."title")) between 1 and 160 and char_length("calendar_template_entries"."notes")<=4000 and "calendar_template_entries"."day_offset" between 0 and 30);--> statement-breakpoint
ALTER TABLE "calendar_templates" ADD CONSTRAINT "calendar_template_fields" CHECK ("calendar_templates"."version">0 and isfinite("calendar_templates"."created_at") and isfinite("calendar_templates"."updated_at") and char_length(btrim("calendar_templates"."name")) between 1 and 160 and (("calendar_templates"."span" in ('day','week') and "calendar_templates"."range_days" is null) or ("calendar_templates"."span"='range' and "calendar_templates"."range_days" between 1 and 31)));
--> statement-breakpoint
CREATE TRIGGER routines_revision BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
