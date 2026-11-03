ALTER TABLE "food_entries" ADD COLUMN "source_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "source" jsonb;