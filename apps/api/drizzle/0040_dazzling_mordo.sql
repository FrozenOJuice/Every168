CREATE TABLE "food_catalogue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"release" text NOT NULL,
	"code" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_fr" text NOT NULL,
	"search_text" text NOT NULL,
	"source_updated_at" text NOT NULL,
	"basis_amount" double precision NOT NULL,
	"basis_unit" text NOT NULL,
	"calories" double precision,
	"protein_g" double precision,
	"carbs_g" double precision,
	"fat_g" double precision,
	"fiber_g" double precision,
	"nutrients" jsonb NOT NULL,
	"portions" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	CONSTRAINT "food_catalogue_provider_release_code_unique" UNIQUE("provider","release","code"),
	CONSTRAINT "catalogue_basis" CHECK ("food_catalogue"."basis_amount">0 and "food_catalogue"."basis_unit" in ('g','ml') and "food_catalogue"."version">0)
);
--> statement-breakpoint
CREATE TABLE "food_catalogue_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"release" text NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "food_catalogue_releases_provider_release_unique" UNIQUE("provider","release")
);
--> statement-breakpoint
CREATE TABLE "nutrition_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 2 NOT NULL,
	"calories" double precision,
	"protein_g" double precision,
	"carbs_g" double precision,
	"fat_g" double precision,
	CONSTRAINT "nutrition_goals_bounds" CHECK ("nutrition_goals"."version">0 and "nutrition_goals"."calories">0 and "nutrition_goals"."calories"<=100000 and "nutrition_goals"."protein_g">0 and "nutrition_goals"."protein_g"<=100000 and "nutrition_goals"."carbs_g">0 and "nutrition_goals"."carbs_g"<=100000 and "nutrition_goals"."fat_g">0 and "nutrition_goals"."fat_g"<=100000)
);
--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "catalogue_id" uuid;--> statement-breakpoint
ALTER TABLE "food_catalogue" ADD CONSTRAINT "food_catalogue_release_id_food_catalogue_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."food_catalogue_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_goals" ADD CONSTRAINT "nutrition_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_catalogue_id_food_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."food_catalogue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_reference_exclusive" CHECK ("food_entries"."food_id" is null or "food_entries"."catalogue_id" is null);