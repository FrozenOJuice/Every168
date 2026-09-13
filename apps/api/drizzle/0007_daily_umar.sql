CREATE TABLE "calendar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"category_id" uuid,
	"goal_id" uuid,
	"kind" text NOT NULL,
	"date" date,
	"end_date" date,
	CONSTRAINT "calendar_item_owner" UNIQUE("user_id","id"),
	CONSTRAINT "calendar_item_fields" CHECK ("calendar_items"."version">0 and isfinite("calendar_items"."created_at") and isfinite("calendar_items"."updated_at") and char_length(btrim("calendar_items"."title")) between 1 and 160 and char_length("calendar_items"."notes")<=4000),
	CONSTRAINT "calendar_item_dates" CHECK (isfinite("calendar_items"."date") and isfinite("calendar_items"."end_date") and (("calendar_items"."kind"='unscheduled' and "calendar_items"."end_date" is null) or ("calendar_items"."kind"='all_day' and "calendar_items"."date" is not null and "calendar_items"."end_date" is not null and "calendar_items"."end_date"-"calendar_items"."date" between 0 and 30)))
);
--> statement-breakpoint
CREATE TABLE "calendar_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"category_id" uuid,
	"goal_id" uuid,
	"timezone" text NOT NULL,
	"start_date" date NOT NULL,
	"until_date" date NOT NULL,
	"start_minute" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer NOT NULL,
	"weekdays" integer[] NOT NULL,
	"excluded_dates" date[] DEFAULT '{}'::date[] NOT NULL,
	CONSTRAINT "calendar_series_owner" UNIQUE("user_id","id"),
	CONSTRAINT "calendar_series_fields" CHECK ("calendar_series"."version">0 and isfinite("calendar_series"."created_at") and isfinite("calendar_series"."updated_at") and char_length(btrim("calendar_series"."title")) between 1 and 160 and char_length("calendar_series"."notes")<=4000 and char_length("calendar_series"."timezone") between 1 and 100),
	CONSTRAINT "calendar_series_rule" CHECK (isfinite("calendar_series"."start_date") and isfinite("calendar_series"."until_date") and "calendar_series"."until_date"-"calendar_series"."start_date" between 0 and 365 and "calendar_series"."start_minute" between 0 and 1439 and "calendar_series"."duration_minutes" between 1 and 44640 and "calendar_series"."frequency" in ('daily','weekly') and "calendar_series"."interval" between 1 and 52 and cardinality("calendar_series"."weekdays") between 1 and 7 and "calendar_series"."weekdays"<@array[0,1,2,3,4,5,6] and array_position("calendar_series"."weekdays",null) is null and cardinality("calendar_series"."excluded_dates")<=366 and array_position("calendar_series"."excluded_dates",null) is null)
);
--> statement-breakpoint
CREATE TABLE "calendar_template_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"category_id" uuid,
	"goal_id" uuid,
	"template_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"day_offset" integer NOT NULL,
	"start_minute" double precision,
	"duration_minutes" double precision,
	"date_span" integer,
	CONSTRAINT "calendar_template_entry_fields" CHECK ("calendar_template_entries"."version">0 and isfinite("calendar_template_entries"."created_at") and isfinite("calendar_template_entries"."updated_at") and char_length(btrim("calendar_template_entries"."title")) between 1 and 160 and char_length("calendar_template_entries"."notes")<=4000 and "calendar_template_entries"."day_offset" between 0 and 6),
	CONSTRAINT "calendar_template_entry_shape" CHECK (("calendar_template_entries"."kind"='block' and "calendar_template_entries"."start_minute" is not null and "calendar_template_entries"."start_minute">=0 and "calendar_template_entries"."start_minute"<1440 and "calendar_template_entries"."duration_minutes" is not null and "calendar_template_entries"."duration_minutes">0 and "calendar_template_entries"."duration_minutes"<=44640 and "calendar_template_entries"."date_span" is null) or ("calendar_template_entries"."kind"='all_day' and "calendar_template_entries"."start_minute" is null and "calendar_template_entries"."duration_minutes" is null and "calendar_template_entries"."date_span" is not null and "calendar_template_entries"."date_span" between 1 and 31) or ("calendar_template_entries"."kind"='unscheduled' and "calendar_template_entries"."start_minute" is null and "calendar_template_entries"."duration_minutes" is null and "calendar_template_entries"."date_span" is null))
);
--> statement-breakpoint
CREATE TABLE "calendar_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"span" text NOT NULL,
	CONSTRAINT "calendar_template_owner" UNIQUE("user_id","id"),
	CONSTRAINT "calendar_template_fields" CHECK ("calendar_templates"."version">0 and isfinite("calendar_templates"."created_at") and isfinite("calendar_templates"."updated_at") and char_length(btrim("calendar_templates"."name")) between 1 and 160 and "calendar_templates"."span" in ('day','week'))
);
--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "occurrence_date" date;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "is_exception" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_user_id_goal_id_goals_user_id_id_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_series" ADD CONSTRAINT "calendar_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_series" ADD CONSTRAINT "calendar_series_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_series" ADD CONSTRAINT "calendar_series_user_id_goal_id_goals_user_id_id_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_template_entries" ADD CONSTRAINT "calendar_template_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_template_entries" ADD CONSTRAINT "calendar_template_entries_user_id_template_id_calendar_templates_user_id_id_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."calendar_templates"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_template_entries" ADD CONSTRAINT "calendar_template_entries_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_template_entries" ADD CONSTRAINT "calendar_template_entries_user_id_goal_id_goals_user_id_id_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_templates" ADD CONSTRAINT "calendar_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_item_date_idx" ON "calendar_items" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "calendar_item_created_idx" ON "calendar_items" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "calendar_template_entry_parent_idx" ON "calendar_template_entries" USING btree ("user_id","template_id");--> statement-breakpoint
CREATE INDEX "calendar_template_created_idx" ON "calendar_templates" USING btree ("user_id","created_at","id");--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_series_id_calendar_series_user_id_id_fk" FOREIGN KEY ("user_id","series_id") REFERENCES "public"."calendar_series"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "block_series_date" UNIQUE("series_id","occurrence_date");--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "block_series_shape" CHECK (("time_blocks"."series_id" is null and "time_blocks"."occurrence_date" is null and not "time_blocks"."is_exception") or ("time_blocks"."series_id" is not null and "time_blocks"."occurrence_date" is not null and isfinite("time_blocks"."occurrence_date")));
--> statement-breakpoint
CREATE TRIGGER calendar_items_revision BEFORE UPDATE ON calendar_items FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
CREATE TRIGGER calendar_series_revision BEFORE UPDATE ON calendar_series FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
CREATE TRIGGER calendar_templates_revision BEFORE UPDATE ON calendar_templates FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
CREATE TRIGGER calendar_template_entries_revision BEFORE UPDATE ON calendar_template_entries FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE FUNCTION validate_calendar_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone)
    OR cardinality(NEW.weekdays)<>(SELECT count(DISTINCT d) FROM unnest(NEW.weekdays) d)
    OR EXISTS (SELECT 1 FROM unnest(NEW.excluded_dates) d WHERE NOT isfinite(d)) THEN
    RAISE EXCEPTION 'Invalid calendar recurrence rule' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calendar_series_validate BEFORE INSERT OR UPDATE ON calendar_series FOR EACH ROW EXECUTE FUNCTION validate_calendar_series();
--> statement-breakpoint
CREATE FUNCTION protect_block_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.series_id IS DISTINCT FROM NEW.series_id OR OLD.occurrence_date IS DISTINCT FROM NEW.occurrence_date THEN
    RAISE EXCEPTION 'Occurrence identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER block_series_identity BEFORE UPDATE ON time_blocks FOR EACH ROW EXECUTE FUNCTION protect_block_series();
--> statement-breakpoint
CREATE FUNCTION advance_block_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=OLD.user_id AND id=OLD.series_id;
    RETURN OLD;
  END IF;
  UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=NEW.user_id AND id=NEW.series_id;
  RETURN NEW;
END $$;
CREATE TRIGGER block_series_revision AFTER INSERT OR UPDATE OR DELETE ON time_blocks FOR EACH ROW EXECUTE FUNCTION advance_block_series();
--> statement-breakpoint
CREATE FUNCTION advance_calendar_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_span text;
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE calendar_templates SET updated_at=clock_timestamp() WHERE user_id=OLD.user_id AND id=OLD.template_id;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.template_id<>NEW.template_id THEN
    RAISE EXCEPTION 'Template entry identity is immutable' USING ERRCODE='23514';
  END IF;
  SELECT span INTO parent_span FROM calendar_templates WHERE user_id=NEW.user_id AND id=NEW.template_id FOR UPDATE;
  IF (parent_span='day' AND NEW.day_offset<>0) OR (TG_OP='INSERT' AND (SELECT count(*) FROM calendar_template_entries WHERE user_id=NEW.user_id AND template_id=NEW.template_id)>=100) THEN
    RAISE EXCEPTION 'Invalid template size or day offset' USING ERRCODE='23514';
  END IF;
  UPDATE calendar_templates SET updated_at=clock_timestamp() WHERE user_id=NEW.user_id AND id=NEW.template_id;
  RETURN NEW;
END $$;
CREATE TRIGGER template_children_revision BEFORE INSERT OR UPDATE OR DELETE ON calendar_template_entries FOR EACH ROW EXECUTE FUNCTION advance_calendar_template();
