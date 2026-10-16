CREATE TABLE "exercise_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "exercise_preference_owner_exercise" UNIQUE("user_id","exercise_id"),
	CONSTRAINT "exercise_preference_revision" CHECK ("exercise_preferences"."version">0 and isfinite("exercise_preferences"."created_at") and isfinite("exercise_preferences"."updated_at"))
);
--> statement-breakpoint
ALTER TABLE "exercise_preferences" ADD CONSTRAINT "exercise_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_preferences" ADD CONSTRAINT "exercise_preferences_user_id_exercise_id_exercises_user_id_id_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" DROP COLUMN "favourite";
--> statement-breakpoint
CREATE TRIGGER exercise_preferences_revision BEFORE UPDATE ON exercise_preferences FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE FUNCTION guard_builtin_exercise_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.catalog_key IS DISTINCT FROM OLD.catalog_key OR
    (OLD.catalog_key IS NOT NULL AND ROW(NEW.name, NEW.notes, NEW.equipment, NEW.muscles, NEW.archived_at) IS DISTINCT FROM ROW(OLD.name, OLD.notes, OLD.equipment, OLD.muscles, OLD.archived_at)) THEN
    RAISE EXCEPTION 'Built-in exercise definitions are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER exercises_builtin_definition BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION guard_builtin_exercise_definition();
