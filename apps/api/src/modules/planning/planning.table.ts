import type { BlockSourceLink, SeriesUndoState } from "./planning.types.js";
import type { Block } from "@168hours/contracts";
import { goals } from "../goals/goals.table.js";
import { calendarSeries } from "./calendar.table.js";
import {
  pgTable,
  jsonb,
  uuid,
  text,
  index,
  unique,
  foreignKey,
  check,
  uniqueIndex,
  boolean,
  date,
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
    seriesId: uuid("series_id"),
    occurrenceDate: date("occurrence_date"),
    isException: boolean("is_exception").notNull().default(false),
    categoryId: uuid("category_id"),
    goalId: uuid("goal_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.seriesId],
      foreignColumns: [calendarSeries.userId, calendarSeries.id],
    }),
    unique("block_series_date").on(t.seriesId, t.occurrenceDate),
    check(
      "block_series_shape",
      sql`(${t.seriesId} is null and ${t.occurrenceDate} is null and not ${t.isException}) or (${t.seriesId} is not null and ${t.occurrenceDate} is not null and isfinite(${t.occurrenceDate}))`,
    ),
    check(
      "timeBlocks_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "block_bounds",
      sql`isfinite(${t.startsAt}) and isfinite(${t.endsAt}) and ${t.endsAt}-${t.startsAt}<=interval '31 days' and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
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
      enum: ["manual", "strength_workout", "cardio_activity", "task_time"],
    })
      .default("manual")
      .notNull(),
    sourceId: uuid("source_id"),
  },
  (t) => [
    check(
      "timeEntries_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "entry_bounds",
      sql`isfinite(${t.startsAt}) and isfinite(${t.endsAt}) and ${t.endsAt}-${t.startsAt}<=interval '31 days' and char_length(btrim(${t.title})) between 1 and 160`,
    ),
    check(
      "entry_source_kind",
      sql`(${t.sourceType}='manual' and ${t.sourceId} is null) or (${t.sourceType} in ('strength_workout','cardio_activity','task_time') and ${t.sourceId} is not null)`,
    ),
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

// A deletion receipt preserves identity and links until its undo is consumed.
export const deletedTimeBlocks = pgTable("deleted_time_blocks", {
  ...ownedColumns(),
  snapshot: jsonb("snapshot").$type<Block>().notNull(),
  linkedEntries: jsonb("linked_entries")
    .$type<Array<{ id: string; version: number }>>()
    .notNull(),
  seriesState: jsonb("series_state").$type<SeriesUndoState>(),
  sourceLinks: jsonb("source_links").$type<BlockSourceLink[]>().notNull(),
});

export const editedTimeBlocks = pgTable("edited_time_blocks", {
  ...ownedColumns(),
  before: jsonb("before").$type<Block>().notNull(),
  after: jsonb("after").$type<Block>().notNull(),
  seriesState: jsonb("series_state").$type<SeriesUndoState>(),
});
