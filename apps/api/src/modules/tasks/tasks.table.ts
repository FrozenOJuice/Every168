import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { ProjectInput, TaskInput, TaskRepeat } from "@168hours/contracts";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
import { timeBlocks } from "../planning/planning.table.js";
export const taskProjects = pgTable(
  "task_projects",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    description: text("description"),
    targetDate: date("target_date"),
    status: text("status", { enum: ["active", "completed", "archived"] })
      .notNull()
      .default("active"),
    sections: jsonb("sections")
      .$type<ProjectInput["sections"]>()
      .notNull()
      .default([]),
  },
  (t) => [
    unique("task_projects_owner_id").on(t.userId, t.id),
    index("task_projects_owner_created").on(t.userId, t.createdAt, t.id),
    check(
      "task_projects_fields",
      sql`${t.version}>0 and char_length(btrim(${t.name})) between 1 and 160 and char_length(${t.description})<=4000 and ${t.status} in ('active','completed','archived') and jsonb_array_length(${t.sections})<=50`,
    ),
  ],
);
export const tasks = pgTable(
  "tasks",
  {
    ...ownedColumns(),
    title: text("title").notNull(),
    notes: text("notes"),
    inbox: boolean("inbox").notNull().default(true),
    projectId: uuid("project_id"),
    sectionId: uuid("section_id"),
    dueDate: date("due_date"),
    plannedDate: date("planned_date"),
    priority: text("priority", { enum: ["none", "low", "medium", "high"] })
      .notNull()
      .default("none"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    subtasks: jsonb("subtasks")
      .$type<TaskInput["subtasks"]>()
      .notNull()
      .default([]),
    repeat: jsonb("repeat").$type<TaskRepeat>(),
    repeatTemplate: jsonb("repeat_template").$type<TaskInput>(),
    status: text("status", { enum: ["todo", "in_progress", "done", "skipped"] })
      .notNull()
      .default("todo"),
    archived: boolean("archived").notNull().default(false),
    completedAt: instant("completed_at"),
    position: doublePrecision("position").notNull(),
    recurrenceKey: uuid("recurrence_key"),
    recurrenceAnchor: date("recurrence_anchor"),
    occurrenceDate: date("occurrence_date"),
    advanced: boolean("advanced").notNull().default(false),
  },
  (t) => [
    unique("tasks_owner_id").on(t.userId, t.id),
    unique("tasks_occurrence").on(t.userId, t.recurrenceKey, t.occurrenceDate),
    foreignKey({
      columns: [t.userId, t.projectId],
      foreignColumns: [taskProjects.userId, taskProjects.id],
    }),
    index("tasks_owner_order").on(t.userId, t.position, t.id),
    index("tasks_owner_due").on(t.userId, t.dueDate),
    index("tasks_owner_project").on(t.userId, t.projectId),
    check(
      "tasks_fields",
      sql`${t.version}>0 and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000 and ${t.status} in ('todo','in_progress','done','skipped') and ${t.priority} in ('none','low','medium','high') and cardinality(${t.tags})<=20 and jsonb_array_length(${t.subtasks})<=100 and ((${t.status} in ('done','skipped'))=(${t.completedAt} is not null))`,
    ),
  ],
);
export const taskSchedules = pgTable(
  "task_schedules",
  {
    ...ownedColumns(),
    taskId: uuid("task_id").notNull(),
    timeBlockId: uuid("time_block_id").references(() => timeBlocks.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.userId, t.timeBlockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
    }),
    unique("task_schedule_block").on(t.timeBlockId),
    index("task_schedule_owner_task").on(t.userId, t.taskId),
  ],
);
export const taskTimes = pgTable(
  "task_times",
  {
    ...ownedColumns(),
    taskId: uuid("task_id").notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    notes: text("notes"),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
    }).onDelete("cascade"),
    index("task_times_owner_start").on(t.userId, t.startsAt),
    index("task_times_owner_task").on(t.userId, t.taskId),
    check(
      "task_times_bounds",
      sql`${t.endsAt}>${t.startsAt} and ${t.endsAt}-${t.startsAt}<=interval '31 days' and char_length(${t.notes})<=4000`,
    ),
  ],
);
