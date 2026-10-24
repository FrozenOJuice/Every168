CREATE TABLE "task_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "task_projects_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "task_projects_fields" CHECK ("task_projects"."version">0 and char_length(btrim("task_projects"."name")) between 1 and 160 and char_length("task_projects"."description")<=4000 and "task_projects"."status" in ('active','completed','archived') and jsonb_array_length("task_projects"."sections")<=50)
);
--> statement-breakpoint
CREATE TABLE "task_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"task_id" uuid NOT NULL,
	"time_block_id" uuid,
	CONSTRAINT "task_schedule_block" UNIQUE("time_block_id")
);
--> statement-breakpoint
CREATE TABLE "task_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"task_id" uuid NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	"notes" text,
	CONSTRAINT "task_times_bounds" CHECK ("task_times"."ends_at">"task_times"."starts_at" and "task_times"."ends_at"-"task_times"."starts_at"<=interval '31 days' and char_length("task_times"."notes")<=4000)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"inbox" boolean DEFAULT true NOT NULL,
	"project_id" uuid,
	"section_id" uuid,
	"due_date" date,
	"planned_date" date,
	"priority" text DEFAULT 'none' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repeat" jsonb,
	"status" text DEFAULT 'todo' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"position" double precision NOT NULL,
	"recurrence_key" uuid,
	"recurrence_anchor" date,
	"occurrence_date" date,
	"advanced" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tasks_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "tasks_occurrence" UNIQUE("user_id","recurrence_key","occurrence_date"),
	CONSTRAINT "tasks_fields" CHECK ("tasks"."version">0 and char_length(btrim("tasks"."title")) between 1 and 160 and char_length("tasks"."notes")<=4000 and "tasks"."status" in ('todo','in_progress','done','skipped') and "tasks"."priority" in ('none','low','medium','high') and cardinality("tasks"."tags")<=20 and jsonb_array_length("tasks"."subtasks")<=100 and (("tasks"."status" in ('done','skipped'))=("tasks"."completed_at" is not null)))
);
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "entry_source_kind";--> statement-breakpoint
ALTER TABLE "task_projects" ADD CONSTRAINT "task_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_user_id_time_block_id_time_blocks_user_id_id_fk" FOREIGN KEY ("user_id","time_block_id") REFERENCES "public"."time_blocks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_times" ADD CONSTRAINT "task_times_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_times" ADD CONSTRAINT "task_times_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_project_id_task_projects_user_id_id_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."task_projects"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_projects_owner_created" ON "task_projects" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "task_schedule_owner_task" ON "task_schedules" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "task_times_owner_start" ON "task_times" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "task_times_owner_task" ON "task_times" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "tasks_owner_order" ON "tasks" USING btree ("user_id","position","id");--> statement-breakpoint
CREATE INDEX "tasks_owner_due" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_owner_project" ON "tasks" USING btree ("user_id","project_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "entry_source_kind" CHECK (("time_entries"."source_type"='manual' and "time_entries"."source_id" is null) or ("time_entries"."source_type" in ('strength_workout','cardio_activity','task_time') and "time_entries"."source_id" is not null));--> statement-breakpoint
CREATE TRIGGER tasks_revision BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER task_projects_revision BEFORE UPDATE ON task_projects FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER task_schedules_revision BEFORE UPDATE ON task_schedules FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
--> statement-breakpoint
CREATE TRIGGER task_times_revision BEFORE UPDATE ON task_times FOR EACH ROW EXECUTE FUNCTION advance_record_revision();
