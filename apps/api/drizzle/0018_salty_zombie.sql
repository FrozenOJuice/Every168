-- Obsolete series undo receipts use an earlier snapshot shape. Development data is disposable.
DELETE FROM calendar_series_changes;
--> statement-breakpoint
ALTER TABLE "calendar_series_changes" ALTER COLUMN "before" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_series_changes" ALTER COLUMN "after" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD COLUMN "occurrence_date" date;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD COLUMN "is_exception" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_series" ADD COLUMN "kind" text DEFAULT 'timed' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_series" ADD COLUMN "date_span" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "deleted_calendar_groups" ADD COLUMN "item_series_states" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_user_id_series_id_calendar_series_user_id_id_fk" FOREIGN KEY ("user_id","series_id") REFERENCES "public"."calendar_series"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_item_series_date" ON "calendar_items" USING btree ("series_id","occurrence_date");--> statement-breakpoint
ALTER TABLE "calendar_series_changes" DROP COLUMN "before_blocks";--> statement-breakpoint
ALTER TABLE "calendar_series_changes" DROP COLUMN "after_blocks";--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_item_series_shape" CHECK (("calendar_items"."series_id" is null and "calendar_items"."occurrence_date" is null and not "calendar_items"."is_exception") or ("calendar_items"."series_id" is not null and "calendar_items"."kind"='all_day' and "calendar_items"."occurrence_date" is not null and isfinite("calendar_items"."occurrence_date")));--> statement-breakpoint
ALTER TABLE "calendar_series" ADD CONSTRAINT "calendar_series_kind" CHECK ("calendar_series"."kind" in ('timed','all_day') and "calendar_series"."date_span" between 1 and 31);
--> statement-breakpoint
-- Series splitting and conversion may change membership while preserving plan identity.
DROP TRIGGER block_series_identity ON time_blocks;
--> statement-breakpoint
DROP FUNCTION protect_block_series();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION advance_block_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=OLD.user_id AND id=OLD.series_id;
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP='INSERT' OR NEW.series_id IS DISTINCT FROM OLD.series_id) THEN
    UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=NEW.user_id AND id=NEW.series_id;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER calendar_item_series_revision AFTER INSERT OR UPDATE OR DELETE ON calendar_items FOR EACH ROW EXECUTE FUNCTION advance_block_series();
