-- A cascading owner deletion may remove children before their aggregate parent.
-- Do not revise a parent whose owner has already been deleted in this transaction.
CREATE OR REPLACE FUNCTION advance_block_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id) THEN
      UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=OLD.user_id AND id=OLD.series_id;
    END IF;
    RETURN OLD;
  END IF;
  UPDATE calendar_series SET updated_at=clock_timestamp() WHERE user_id=NEW.user_id AND id=NEW.series_id;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION advance_calendar_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_span text;
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id) THEN
      UPDATE calendar_templates SET updated_at=clock_timestamp() WHERE user_id=OLD.user_id AND id=OLD.template_id;
    END IF;
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
