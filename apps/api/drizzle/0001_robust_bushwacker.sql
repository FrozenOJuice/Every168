CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"archived_at" timestamp (3) with time zone,
	CONSTRAINT "category_owner_id" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"category_id" uuid,
	"goal_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "block_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "block_positive_duration" CHECK ("time_blocks"."ends_at">"time_blocks"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"category_id" uuid,
	"time_block_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	CONSTRAINT "entry_positive_duration" CHECK ("time_entries"."ends_at">"time_entries"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_time_block_id_time_blocks_user_id_id_fk" FOREIGN KEY ("user_id","time_block_id") REFERENCES "public"."time_blocks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "block_user_start_idx" ON "time_blocks" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "entry_user_start_idx" ON "time_entries" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_unique_source" ON "time_entries" USING btree ("user_id","source_type","source_id") WHERE "time_entries"."source_id" is not null;