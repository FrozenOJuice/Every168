import { goals } from "../goals/goals.table.js";
import {
  pgTable,
  uuid,
  text,
  index,
  unique,
  foreignKey,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
import { categories } from "../categories/categories.table.js";
export const timeBlocks = pgTable(
  "time_blocks",
  {
    ...ownedColumns(),
    categoryId: uuid("category_id"),
    goalId: uuid("goal_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
  },
  (t) => [
    unique("block_owner_id").on(t.userId, t.id),
    index("block_user_start_idx").on(t.userId, t.startsAt),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
    }),
    check("block_positive_duration", sql`${t.endsAt}>${t.startsAt}`),
  ],
);
export const timeEntries = pgTable(
  "time_entries",
  {
    ...ownedColumns(),
    categoryId: uuid("category_id"),
    timeBlockId: uuid("time_block_id"),
    title: text("title").notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    sourceType: text("source_type", {
      enum: ["manual", "strength_workout", "cardio_activity"],
    })
      .default("manual")
      .notNull(),
    sourceId: uuid("source_id"),
  },
  (t) => [
    index("entry_user_start_idx").on(t.userId, t.startsAt),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      columns: [t.userId, t.timeBlockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
    }),
    check("entry_positive_duration", sql`${t.endsAt}>${t.startsAt}`),
    uniqueIndex("entry_unique_source")
      .on(t.userId, t.sourceType, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
  ],
);
