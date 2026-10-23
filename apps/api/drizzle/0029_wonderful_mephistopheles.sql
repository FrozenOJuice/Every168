ALTER TABLE "exercises" DROP CONSTRAINT "exercise_logging_type";--> statement-breakpoint
ALTER TABLE "strength_sets" DROP CONSTRAINT "set_positive_values";--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" DROP CONSTRAINT "workout_exercise_logging_type";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "intent_tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "distance_meters" double precision;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "laps" integer;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "target_distance_meters" double precision;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "target_laps" integer;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD COLUMN "intent_tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercise_logging_type" CHECK ("exercises"."logging_type" in ('reps_load','reps','duration','duration_load','distance_duration','laps_duration'));--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "set_positive_values" CHECK ((not "strength_sets"."completed" or "strength_sets"."reps" is not null or "strength_sets"."duration_seconds" is not null or "strength_sets"."distance_meters" is not null or "strength_sets"."laps" is not null) and ("strength_sets"."distance_meters" is null or ("strength_sets"."distance_meters" > 0 and "strength_sets"."distance_meters" <= 10000000)) and ("strength_sets"."target_distance_meters" is null or ("strength_sets"."target_distance_meters" > 0 and "strength_sets"."target_distance_meters" <= 10000000)) and ("strength_sets"."laps" is null or "strength_sets"."laps" between 1 and 10000) and ("strength_sets"."target_laps" is null or "strength_sets"."target_laps" between 1 and 10000) and not ("strength_sets"."completed" and "strength_sets"."skipped") and ("strength_sets"."target_reps" is null or "strength_sets"."target_reps" between 1 and 10000) and ("strength_sets"."target_weight_kg" is null or "strength_sets"."target_weight_kg" between 0 and 2000) and ("strength_sets"."target_duration_seconds" is null or "strength_sets"."target_duration_seconds" between 1 and 86400) and ("strength_sets"."rest_seconds" is null or "strength_sets"."rest_seconds" between 0 and 3600) and ("strength_sets"."reps" is null or "strength_sets"."reps">0) and ("strength_sets"."duration_seconds" is null or "strength_sets"."duration_seconds">0) and ("strength_sets"."weight_kg" is null or "strength_sets"."weight_kg">=0));--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "workout_exercise_logging_type" CHECK ("strength_workout_exercises"."logging_type" in ('reps_load','reps','duration','duration_load','distance_duration','laps_duration'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_builtin_exercise_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.catalog_key IS DISTINCT FROM OLD.catalog_key OR
    (OLD.catalog_key IS NOT NULL AND ROW(NEW.name, NEW.notes, NEW.equipment, NEW.muscles, NEW.logging_type, NEW.intent_tags, NEW.archived_at) IS DISTINCT FROM ROW(OLD.name, OLD.notes, OLD.equipment, OLD.muscles, OLD.logging_type, OLD.intent_tags, OLD.archived_at)) THEN
    RAISE EXCEPTION 'Built-in exercise definitions are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
