-- Conversion and splitting can change membership; a surviving occurrence keeps
-- its nominal date so individual moves remain exceptions to the same occurrence.
CREATE FUNCTION protect_block_series() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.series_id IS NOT NULL AND NEW.series_id IS NOT NULL AND OLD.occurrence_date IS DISTINCT FROM NEW.occurrence_date THEN
    RAISE EXCEPTION 'Occurrence identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER block_series_identity BEFORE UPDATE ON time_blocks FOR EACH ROW EXECUTE FUNCTION protect_block_series();
--> statement-breakpoint
CREATE TRIGGER calendar_item_series_identity BEFORE UPDATE ON calendar_items FOR EACH ROW EXECUTE FUNCTION protect_block_series();
