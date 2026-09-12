CREATE TABLE "write_receipts" (
	"user_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "write_receipts_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "weight_entries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "water_entries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "write_receipts" ADD CONSTRAINT "write_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD CONSTRAINT "cardio_activities_user_id_linked_time_block_id_time_blocks_user_id_id_fk" FOREIGN KEY ("user_id","linked_time_block_id") REFERENCES "public"."time_blocks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD CONSTRAINT "strength_workouts_user_id_linked_time_block_id_time_blocks_user_id_id_fk" FOREIGN KEY ("user_id","linked_time_block_id") REFERENCES "public"."time_blocks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "set_position" UNIQUE("user_id","workout_exercise_id","position");--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "workout_exercise_position" UNIQUE("user_id","workout_id","position");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "account_provider_identity" UNIQUE("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weightEntries_revision" CHECK ("weight_entries"."version">0 and isfinite("weight_entries"."created_at") and isfinite("weight_entries"."updated_at"));--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_bounds" CHECK ("weight_entries"."weight_kg" between 1 and 1000 and isfinite("weight_entries"."measured_at"));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_revision" CHECK ("categories"."version">0 and isfinite("categories"."created_at") and isfinite("categories"."updated_at"));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "category_fields" CHECK (char_length(btrim("categories"."name")) between 1 and 160 and ("categories"."color" is null or "categories"."color" ~ '^#[0-9a-fA-F]{6}$') and char_length("categories"."icon")<=40);--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD CONSTRAINT "cardioActivities_revision" CHECK ("cardio_activities"."version">0 and isfinite("cardio_activities"."created_at") and isfinite("cardio_activities"."updated_at"));--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD CONSTRAINT "cardio_bounds" CHECK ("cardio_activities"."activity_type" in ('run','walk','swim','cycle','skip','other') and isfinite("cardio_activities"."started_at") and "cardio_activities"."duration_seconds"<=2678400 and "cardio_activities"."distance_meters"<=10000000 and char_length(btrim("cardio_activities"."title")) between 1 and 160 and char_length("cardio_activities"."notes")<=4000);--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_revision" CHECK ("exercises"."version">0 and isfinite("exercises"."created_at") and isfinite("exercises"."updated_at"));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercise_fields" CHECK (char_length(btrim("exercises"."name")) between 1 and 160 and char_length("exercises"."notes")<=4000);--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "strengthSets_revision" CHECK ("strength_sets"."version">0 and isfinite("strength_sets"."created_at") and isfinite("strength_sets"."updated_at"));--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "set_bounds" CHECK ("strength_sets"."position" between 0 and 99 and "strength_sets"."reps"<=10000 and "strength_sets"."duration_seconds"<=86400 and "strength_sets"."weight_kg"<=2000);--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD CONSTRAINT "strengthWorkouts_revision" CHECK ("strength_workouts"."version">0 and isfinite("strength_workouts"."created_at") and isfinite("strength_workouts"."updated_at"));--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD CONSTRAINT "workout_bounds" CHECK (isfinite("strength_workouts"."started_at") and isfinite("strength_workouts"."ended_at") and "strength_workouts"."ended_at"-"strength_workouts"."started_at"<=interval '31 days' and char_length(btrim("strength_workouts"."title")) between 1 and 160 and char_length("strength_workouts"."notes")<=4000);--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "workoutExercises_revision" CHECK ("strength_workout_exercises"."version">0 and isfinite("strength_workout_exercises"."created_at") and isfinite("strength_workout_exercises"."updated_at"));--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "workout_exercise_fields" CHECK ("strength_workout_exercises"."position" between 0 and 49 and char_length(btrim("strength_workout_exercises"."exercise_name_snapshot")) between 1 and 160 and char_length("strength_workout_exercises"."notes")<=4000);--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_revision" CHECK ("goals"."version">0 and isfinite("goals"."created_at") and isfinite("goals"."updated_at"));--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goal_fields" CHECK (char_length(btrim("goals"."title")) between 1 and 160 and char_length("goals"."description")<=4000);--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goal_status" CHECK ("goals"."status" in ('active','completed','paused','archived') and (("goals"."status"='completed') = ("goals"."completed_at" is not null)) and isfinite("goals"."completed_at") and isfinite("goals"."target_date"));--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "waterEntries_revision" CHECK ("water_entries"."version">0 and isfinite("water_entries"."created_at") and isfinite("water_entries"."updated_at"));--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_bounds" CHECK ("water_entries"."amount_ml" between 1 and 10000 and isfinite("water_entries"."consumed_at"));--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_values" CHECK ("preferences"."version">0 and "preferences"."week_starts_on" in (0,1) and "preferences"."weight_unit" in ('kg','lb') and "preferences"."distance_unit" in ('km','mi') and char_length("preferences"."timezone") between 1 and 100);--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "foodEntries_revision" CHECK ("food_entries"."version">0 and isfinite("food_entries"."created_at") and isfinite("food_entries"."updated_at"));--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entry_bounds" CHECK ("food_entries"."quantity"<=1000 and isfinite("food_entries"."consumed_at") and "food_entries"."meal_type" in ('breakfast','lunch','dinner','snack','other'));--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_snapshot_bounds" CHECK (char_length(btrim("food_entries"."name_snapshot")) between 1 and 160 and "food_entries"."serving_unit_snapshot" in ('g','ml','item','serving') and "food_entries"."serving_amount_snapshot">0 and "food_entries"."serving_amount_snapshot"<=100000 and "food_entries"."calories_snapshot" between 0 and 100000 and "food_entries"."protein_g_snapshot" between 0 and 100000 and "food_entries"."carbs_g_snapshot" between 0 and 100000 and "food_entries"."fat_g_snapshot" between 0 and 100000 and "food_entries"."fiber_g_snapshot" between 0 and 100000);--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_revision" CHECK ("foods"."version">0 and isfinite("foods"."created_at") and isfinite("foods"."updated_at"));--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "food_bounds" CHECK (char_length(btrim("foods"."name")) between 1 and 160 and "foods"."serving_unit" in ('g','ml','item','serving') and "foods"."serving_amount"<=100000 and "foods"."calories"<=100000 and "foods"."protein_g"<=100000 and "foods"."carbs_g"<=100000 and "foods"."fat_g"<=100000 and "foods"."fiber_g"<=100000);--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "timeBlocks_revision" CHECK ("time_blocks"."version">0 and isfinite("time_blocks"."created_at") and isfinite("time_blocks"."updated_at"));--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "block_bounds" CHECK (isfinite("time_blocks"."starts_at") and isfinite("time_blocks"."ends_at") and "time_blocks"."ends_at"-"time_blocks"."starts_at"<=interval '31 days' and char_length(btrim("time_blocks"."title")) between 1 and 160 and char_length("time_blocks"."notes")<=4000);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "timeEntries_revision" CHECK ("time_entries"."version">0 and isfinite("time_entries"."created_at") and isfinite("time_entries"."updated_at"));--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "entry_bounds" CHECK (isfinite("time_entries"."starts_at") and isfinite("time_entries"."ends_at") and "time_entries"."ends_at"-"time_entries"."starts_at"<=interval '31 days' and char_length(btrim("time_entries"."title")) between 1 and 160);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "entry_source_kind" CHECK (("time_entries"."source_type"='manual' and "time_entries"."source_id" is null) or ("time_entries"."source_type" in ('strength_workout','cardio_activity') and "time_entries"."source_id" is not null));
--> statement-breakpoint
-- Revisions also advance for FK SET NULL and direct SQL updates. Identity and
-- creation metadata cannot be reassigned by a repository update.
CREATE FUNCTION advance_record_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (to_jsonb(NEW)->'id') IS DISTINCT FROM (to_jsonb(OLD)->'id') THEN
    RAISE EXCEPTION 'Record identity is immutable' USING ERRCODE = '23514';
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER weight_entries_revision BEFORE UPDATE ON weight_entries
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER water_entries_revision BEFORE UPDATE ON water_entries
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER categories_revision BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER goals_revision BEFORE UPDATE ON goals
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER preferences_revision BEFORE UPDATE ON preferences
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER time_blocks_revision BEFORE UPDATE ON time_blocks
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER time_entries_revision BEFORE UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER foods_revision BEFORE UPDATE ON foods
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER food_entries_revision BEFORE UPDATE ON food_entries
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER exercises_revision BEFORE UPDATE ON exercises
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER strength_workouts_revision BEFORE UPDATE ON strength_workouts
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER strength_workout_exercises_revision BEFORE UPDATE ON strength_workout_exercises
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER strength_sets_revision BEFORE UPDATE ON strength_sets
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER cardio_activities_revision BEFORE UPDATE ON cardio_activities
FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE FUNCTION protect_food_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['quantity','meal_type','consumed_at','updated_at','version'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['quantity','meal_type','consumed_at','updated_at','version']) THEN
    RAISE EXCEPTION 'Food history snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER food_entry_snapshot BEFORE UPDATE ON food_entries
FOR EACH ROW EXECUTE FUNCTION protect_food_snapshot();
