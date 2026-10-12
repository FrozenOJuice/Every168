import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  integer,
  doublePrecision,
  date,
  check,
  unique,
  index,
  foreignKey,
  jsonb,
} from "drizzle-orm/pg-core";
import type { CalendarItem, CalendarSeries, Block } from "@168hours/contracts";
import { ownedColumns } from "../../infrastructure/database/columns.js";
import { categories } from "../categories/categories.table.js";
import { goals } from "../goals/goals.table.js";

const details = () => ({
  title: text("title").notNull(),
  notes: text("notes"),
  categoryId: uuid("category_id"),
  goalId: uuid("goal_id"),
});
export const calendarItems = pgTable(
  "calendar_items",
  {
    ...ownedColumns(),
    ...details(),
    kind: text("kind", { enum: ["all_day", "unscheduled"] }).notNull(),
    date: date("date"),
    endDate: date("end_date"),
  },
  (t) => [
    unique("calendar_item_owner").on(t.userId, t.id),
    index("calendar_item_date_idx").on(t.userId, t.date),
    index("calendar_item_created_idx").on(t.userId, t.createdAt, t.id),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
    }),
    check(
      "calendar_item_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
    check(
      "calendar_item_dates",
      sql`isfinite(${t.date}) and isfinite(${t.endDate}) and ((${t.kind}='unscheduled' and ${t.endDate} is null) or (${t.kind}='all_day' and ${t.date} is not null and ${t.endDate} is not null and ${t.endDate}-${t.date} between 0 and 30))`,
    ),
  ],
);
export const deletedCalendarGroups = pgTable("deleted_calendar_groups", {
  ...ownedColumns(),
  blockUndoIds: jsonb("block_undo_ids").$type<string[]>().notNull(),
  items: jsonb("items").$type<CalendarItem[]>().notNull(),
});
export const calendarSeriesChanges = pgTable("calendar_series_changes", {
  ...ownedColumns(),
  seriesId: uuid("series_id").notNull(),
  before: jsonb("before").$type<CalendarSeries>(),
  after: jsonb("after").$type<CalendarSeries>(),
  beforeBlocks: jsonb("before_blocks").$type<Block[]>().notNull(),
  afterBlocks: jsonb("after_blocks").$type<Block[]>().notNull(),
  removedBlockUndoIds: jsonb("removed_block_undo_ids")
    .$type<string[]>()
    .notNull(),
});
export const calendarSeries = pgTable(
  "calendar_series",
  {
    ...ownedColumns(),
    ...details(),
    timezone: text("timezone").notNull(),
    startDate: date("start_date").notNull(),
    untilDate: date("until_date").notNull(),
    startMinute: integer("start_minute").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    frequency: text("frequency", { enum: ["daily", "weekly"] }).notNull(),
    interval: integer("interval").notNull(),
    weekdays: integer("weekdays").array().notNull(),
    excludedDates: date("excluded_dates")
      .array()
      .notNull()
      .default(sql`'{}'::date[]`),
  },
  (t) => [
    unique("calendar_series_owner").on(t.userId, t.id),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
    }),
    check(
      "calendar_series_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000 and char_length(${t.timezone}) between 1 and 100`,
    ),
    check(
      "calendar_series_rule",
      sql`isfinite(${t.startDate}) and isfinite(${t.untilDate}) and ${t.untilDate}-${t.startDate} between 0 and 365 and ${t.startMinute} between 0 and 1439 and ${t.durationMinutes} between 1 and 44640 and ${t.frequency} in ('daily','weekly') and ${t.interval} between 1 and 52 and cardinality(${t.weekdays}) between 1 and 7 and ${t.weekdays}<@array[0,1,2,3,4,5,6] and array_position(${t.weekdays},null) is null and cardinality(${t.excludedDates})<=366 and array_position(${t.excludedDates},null) is null`,
    ),
  ],
);
export const calendarTemplates = pgTable(
  "calendar_templates",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    span: text("span", { enum: ["day", "week", "range"] }).notNull(),
    rangeDays: integer("range_days"),
  },
  (t) => [
    unique("calendar_template_owner").on(t.userId, t.id),
    index("calendar_template_created_idx").on(t.userId, t.createdAt, t.id),
    check(
      "calendar_template_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and char_length(btrim(${t.name})) between 1 and 160 and ((${t.span} in ('day','week') and ${t.rangeDays} is null) or (${t.span}='range' and ${t.rangeDays} between 1 and 31))`,
    ),
  ],
);
export const calendarTemplateEntries = pgTable(
  "calendar_template_entries",
  {
    ...ownedColumns(),
    ...details(),
    templateId: uuid("template_id").notNull(),
    kind: text("kind", { enum: ["block", "all_day", "unscheduled"] }).notNull(),
    dayOffset: integer("day_offset").notNull(),
    startMinute: doublePrecision("start_minute"),
    durationMinutes: doublePrecision("duration_minutes"),
    dateSpan: integer("date_span"),
  },
  (t) => [
    index("calendar_template_entry_parent_idx").on(t.userId, t.templateId),
    foreignKey({
      columns: [t.userId, t.templateId],
      foreignColumns: [calendarTemplates.userId, calendarTemplates.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
    }),
    check(
      "calendar_template_entry_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000 and ${t.dayOffset} between 0 and 30`,
    ),
    check(
      "calendar_template_entry_shape",
      sql`(${t.kind}='block' and ${t.startMinute} is not null and ${t.startMinute}>=0 and ${t.startMinute}<1440 and ${t.durationMinutes} is not null and ${t.durationMinutes}>0 and ${t.durationMinutes}<=44640 and ${t.dateSpan} is null) or (${t.kind}='all_day' and ${t.startMinute} is null and ${t.durationMinutes} is null and ${t.dateSpan} is not null and ${t.dateSpan} between 1 and 31) or (${t.kind}='unscheduled' and ${t.startMinute} is null and ${t.durationMinutes} is null and ${t.dateSpan} is null)`,
    ),
  ],
);
