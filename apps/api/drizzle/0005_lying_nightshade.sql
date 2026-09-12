CREATE TABLE "cardio_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"activity_type" text NOT NULL,
	"title" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"distance_meters" double precision,
	"notes" text,
	"linked_time_block_id" uuid,
	CONSTRAINT "cardio_positive_values" CHECK ("cardio_activities"."duration_seconds">0 and ("cardio_activities"."distance_meters" is null or "cardio_activities"."distance_meters">0))
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"archived_at" timestamp (3) with time zone,
	CONSTRAINT "exercise_owner_id" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "strength_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"reps" integer,
	"weight_kg" double precision,
	"duration_seconds" integer,
	"completed" boolean NOT NULL,
	CONSTRAINT "set_positive_values" CHECK (("strength_sets"."reps" is not null or "strength_sets"."duration_seconds" is not null) and ("strength_sets"."reps" is null or "strength_sets"."reps">0) and ("strength_sets"."duration_seconds" is null or "strength_sets"."duration_seconds">0) and ("strength_sets"."weight_kg" is null or "strength_sets"."weight_kg">=0))
);
--> statement-breakpoint
CREATE TABLE "strength_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"notes" text,
	"linked_time_block_id" uuid,
	CONSTRAINT "workout_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "workout_positive_duration" CHECK ("strength_workouts"."ended_at">"strength_workouts"."started_at")
);
--> statement-breakpoint
CREATE TABLE "strength_workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"exercise_name_snapshot" text NOT NULL,
	"position" integer NOT NULL,
	"notes" text,
	CONSTRAINT "workout_exercise_owner_id" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD CONSTRAINT "cardio_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardio_activities" ADD CONSTRAINT "cardio_activities_linked_time_block_id_time_blocks_id_fk" FOREIGN KEY ("linked_time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "strength_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "strength_sets_user_id_workout_exercise_id_strength_workout_exercises_user_id_id_fk" FOREIGN KEY ("user_id","workout_exercise_id") REFERENCES "public"."strength_workout_exercises"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD CONSTRAINT "strength_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workouts" ADD CONSTRAINT "strength_workouts_linked_time_block_id_time_blocks_id_fk" FOREIGN KEY ("linked_time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "strength_workout_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "strength_workout_exercises_user_id_workout_id_strength_workouts_user_id_id_fk" FOREIGN KEY ("user_id","workout_id") REFERENCES "public"."strength_workouts"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_workout_exercises" ADD CONSTRAINT "strength_workout_exercises_user_id_exercise_id_exercises_user_id_id_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cardio_user_created_idx" ON "cardio_activities" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "cardio_user_start_idx" ON "cardio_activities" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "exercise_user_created_idx" ON "exercises" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "set_parent_idx" ON "strength_sets" USING btree ("user_id","workout_exercise_id");--> statement-breakpoint
CREATE INDEX "workout_user_created_idx" ON "strength_workouts" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workout_user_start_idx" ON "strength_workouts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "workout_exercise_parent_idx" ON "strength_workout_exercises" USING btree ("user_id","workout_id");--> statement-breakpoint
CREATE INDEX "workout_exercise_progress_idx" ON "strength_workout_exercises" USING btree ("user_id","exercise_id");