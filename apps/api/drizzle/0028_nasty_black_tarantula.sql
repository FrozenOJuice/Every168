ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_owner_id" UNIQUE("user_id","id");--> statement-breakpoint
CREATE TABLE "training_program_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"program_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"cycle" integer NOT NULL,
	"position" integer NOT NULL,
	"step_id" uuid NOT NULL,
	"workout_title_snapshot" text NOT NULL,
	"planned_date" date,
	"skipped_at" timestamp (3) with time zone,
	"plan_id" uuid,
	CONSTRAINT "program_occurrence_sequence" UNIQUE("user_id","program_id","sequence"),
	CONSTRAINT "program_occurrence_plan" UNIQUE("plan_id"),
	CONSTRAINT "program_occurrence_fields" CHECK ("training_program_occurrences"."version">0 and isfinite("training_program_occurrences"."created_at") and isfinite("training_program_occurrences"."updated_at") and ("training_program_occurrences"."skipped_at" is null or isfinite("training_program_occurrences"."skipped_at")) and ("training_program_occurrences"."planned_date" is null or isfinite("training_program_occurrences"."planned_date")) and "training_program_occurrences"."sequence" between 0 and 1000000 and "training_program_occurrences"."cycle" between 1 and 1000001 and "training_program_occurrences"."position" between 0 and 19 and char_length(btrim("training_program_occurrences"."workout_title_snapshot")) between 1 and 160)
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"start_date" date NOT NULL,
	"training_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"steps" jsonb NOT NULL,
	CONSTRAINT "training_program_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "training_program_fields" CHECK ("training_programs"."version">0 and isfinite("training_programs"."created_at") and isfinite("training_programs"."updated_at") and isfinite("training_programs"."start_date") and char_length(btrim("training_programs"."title")) between 1 and 160 and char_length("training_programs"."notes")<=4000 and cardinality("training_programs"."training_days")<=7 and "training_programs"."training_days" <@ ARRAY[0,1,2,3,4,5,6]::integer[] and jsonb_typeof("training_programs"."steps")='array' and jsonb_array_length("training_programs"."steps") between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "training_program_occurrences" ADD CONSTRAINT "training_program_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_occurrences" ADD CONSTRAINT "training_program_occurrences_plan_id_strength_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."strength_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_occurrences" ADD CONSTRAINT "training_program_occurrences_user_id_program_id_training_programs_user_id_id_fk" FOREIGN KEY ("user_id","program_id") REFERENCES "public"."training_programs"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_occurrences" ADD CONSTRAINT "training_program_occurrences_user_id_plan_id_strength_plans_user_id_id_fk" FOREIGN KEY ("user_id","plan_id") REFERENCES "public"."strength_plans"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_occurrence_owner_created" ON "training_program_occurrences" USING btree ("user_id","program_id","created_at","id");--> statement-breakpoint
CREATE INDEX "training_program_owner_created" ON "training_programs" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE TRIGGER training_programs_revision BEFORE UPDATE ON training_programs FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER training_program_occurrences_revision BEFORE UPDATE ON training_program_occurrences FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
