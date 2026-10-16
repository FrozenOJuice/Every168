ALTER TABLE "exercises" ADD COLUMN "catalog_key" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercise_owner_catalog_key" UNIQUE("user_id","catalog_key");