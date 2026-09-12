CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"weight_kg" double precision NOT NULL,
	"measured_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "body_positive_value" CHECK ("weight_entries"."weight_kg">0)
);
--> statement-breakpoint
CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"amount_ml" integer NOT NULL,
	"consumed_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "hydration_positive_value" CHECK ("water_entries"."amount_ml">0)
);
--> statement-breakpoint
CREATE TABLE "food_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"food_id" uuid,
	"consumed_at" timestamp (3) with time zone NOT NULL,
	"quantity" double precision NOT NULL,
	"meal_type" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"serving_amount_snapshot" double precision NOT NULL,
	"serving_unit_snapshot" text NOT NULL,
	"calories_snapshot" double precision NOT NULL,
	"protein_g_snapshot" double precision,
	"carbs_g_snapshot" double precision,
	"fat_g_snapshot" double precision,
	"fiber_g_snapshot" double precision,
	CONSTRAINT "food_entry_positive_quantity" CHECK ("food_entries"."quantity">0)
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"serving_amount" double precision NOT NULL,
	"serving_unit" text NOT NULL,
	"calories" double precision NOT NULL,
	"protein_g" double precision,
	"carbs_g" double precision,
	"fat_g" double precision,
	"fiber_g" double precision,
	"archived_at" timestamp (3) with time zone,
	CONSTRAINT "food_owner_id" UNIQUE("user_id","id"),
	CONSTRAINT "food_positive_serving" CHECK ("foods"."serving_amount">0),
	CONSTRAINT "food_nonnegative_nutrients" CHECK ("foods"."calories">=0 and "foods"."protein_g">=0 and "foods"."carbs_g">=0 and "foods"."fat_g">=0 and "foods"."fiber_g">=0)
);
--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_user_id_food_id_foods_user_id_id_fk" FOREIGN KEY ("user_id","food_id") REFERENCES "public"."foods"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_user_time_idx" ON "weight_entries" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE INDEX "body_user_created_idx" ON "weight_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "hydration_user_time_idx" ON "water_entries" USING btree ("user_id","consumed_at");--> statement-breakpoint
CREATE INDEX "hydration_user_created_idx" ON "water_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "food_entry_user_consumed_idx" ON "food_entries" USING btree ("user_id","consumed_at");--> statement-breakpoint
CREATE INDEX "food_user_created_idx" ON "foods" USING btree ("user_id","created_at","id");