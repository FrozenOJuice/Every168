CREATE TABLE "strength_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"kind" text NOT NULL,
	"exercises" jsonb NOT NULL,
	"time_block_id" uuid,
	"session_id" uuid,
	CONSTRAINT "strength_plans_block" UNIQUE("time_block_id"),
	CONSTRAINT "strength_plans_fields" CHECK ("strength_plans"."version">0 and char_length(btrim("strength_plans"."title")) between 1 and 160 and char_length("strength_plans"."notes")<=4000 and "strength_plans"."kind" in ('workout','scheduled') and jsonb_typeof("strength_plans"."exercises")='array' and jsonb_array_length("strength_plans"."exercises") between 1 and 50 and ("strength_plans"."kind"='scheduled' or ("strength_plans"."time_block_id" is null and "strength_plans"."session_id" is null)))
);
--> statement-breakpoint
ALTER TABLE "strength_sets" DROP CONSTRAINT "set_positive_values";--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "target_reps" integer;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "target_weight_kg" double precision;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "target_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "strength_sets" ADD COLUMN "rest_seconds" integer;--> statement-breakpoint
ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_session_id_strength_workouts_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."strength_workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_user_id_time_block_id_time_blocks_user_id_id_fk" FOREIGN KEY ("user_id","time_block_id") REFERENCES "public"."time_blocks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_plans" ADD CONSTRAINT "strength_plans_user_id_session_id_strength_workouts_user_id_id_fk" FOREIGN KEY ("user_id","session_id") REFERENCES "public"."strength_workouts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "strength_plans_owner_created" ON "strength_plans" USING btree ("user_id","created_at","id");--> statement-breakpoint
ALTER TABLE "strength_sets" ADD CONSTRAINT "set_positive_values" CHECK ((not "strength_sets"."completed" or "strength_sets"."reps" is not null or "strength_sets"."duration_seconds" is not null) and not ("strength_sets"."completed" and "strength_sets"."skipped") and ("strength_sets"."target_reps" is null or "strength_sets"."target_reps" between 1 and 10000) and ("strength_sets"."target_weight_kg" is null or "strength_sets"."target_weight_kg" between 0 and 2000) and ("strength_sets"."target_duration_seconds" is null or "strength_sets"."target_duration_seconds" between 1 and 86400) and ("strength_sets"."rest_seconds" is null or "strength_sets"."rest_seconds" between 0 and 3600) and ("strength_sets"."reps" is null or "strength_sets"."reps">0) and ("strength_sets"."duration_seconds" is null or "strength_sets"."duration_seconds">0) and ("strength_sets"."weight_kg" is null or "strength_sets"."weight_kg">=0));
--> statement-breakpoint
CREATE TRIGGER strength_plans_revision BEFORE UPDATE ON strength_plans FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
