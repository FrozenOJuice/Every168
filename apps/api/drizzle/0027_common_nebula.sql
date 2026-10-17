ALTER TABLE "exercises" ADD COLUMN "logging_type" text DEFAULT 'reps_load' NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD COLUMN "logging_type" text DEFAULT 'reps_load' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercise_logging_type" CHECK ("exercises"."logging_type" in ('reps_load','reps','duration','duration_load'));--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "workout_exercise_logging_type" CHECK ("strength_workout_exercises"."logging_type" in ('reps_load','reps','duration','duration_load'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_builtin_exercise_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.catalog_key IS DISTINCT FROM OLD.catalog_key OR
    (OLD.catalog_key IS NOT NULL AND ROW(NEW.name, NEW.notes, NEW.equipment, NEW.muscles, NEW.logging_type, NEW.archived_at) IS DISTINCT FROM ROW(OLD.name, OLD.notes, OLD.equipment, OLD.muscles, OLD.logging_type, OLD.archived_at)) THEN
    RAISE EXCEPTION 'Built-in exercise definitions are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
