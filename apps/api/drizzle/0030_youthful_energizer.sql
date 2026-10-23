ALTER TABLE "food_entries" ALTER COLUMN "calories_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ALTER COLUMN "calories" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "kind_snapshot" text DEFAULT 'food' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "ingredients_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "yield_servings_snapshot" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "favourite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "kind" text DEFAULT 'food' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "yield_servings" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entry_preparation_bounds" CHECK ("food_entries"."kind_snapshot" in ('food','meal','recipe') and "food_entries"."yield_servings_snapshot" between 1 and 1000 and jsonb_typeof("food_entries"."ingredients_snapshot")='array' and jsonb_array_length("food_entries"."ingredients_snapshot")<=50);--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "food_preparation_bounds" CHECK ("foods"."kind" in ('food','meal','recipe') and "foods"."yield_servings" between 1 and 1000 and char_length("foods"."instructions")<=4000 and jsonb_typeof("foods"."ingredients")='array' and jsonb_array_length("foods"."ingredients")<=50 and ("foods"."kind"='recipe' or "foods"."yield_servings"=1) and (("foods"."kind"='food' and jsonb_array_length("foods"."ingredients")=0) or ("foods"."kind"<>'food' and jsonb_array_length("foods"."ingredients")>0 and "foods"."serving_amount"=1 and "foods"."serving_unit"='serving')));