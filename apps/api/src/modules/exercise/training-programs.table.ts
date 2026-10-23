import {
  pgTable,
  text,
  integer,
  jsonb,
  boolean,
  date,
  uuid,
  index,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
import { strengthPlans } from "./exercise.table.js";
export type StoredProgramStep = {
  id: string;
  workoutId: string;
  title: string;
};
export const trainingPrograms = pgTable(
  "training_programs",
  {
    ...ownedColumns(),
    title: text("title").notNull(),
    notes: text("notes"),
    startDate: date("start_date").notNull(),
    trainingDays: integer("training_days")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    paused: boolean("paused").notNull().default(false),
    steps: jsonb("steps").$type<StoredProgramStep[]>().notNull(),
  },
  (t) => [
    unique("training_program_owner_id").on(t.userId, t.id),
    index("training_program_owner_created").on(t.userId, t.createdAt, t.id),
    check(
      "training_program_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and isfinite(${t.startDate}) and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000 and cardinality(${t.trainingDays})<=7 and ${t.trainingDays} <@ ARRAY[0,1,2,3,4,5,6]::integer[] and jsonb_typeof(${t.steps})='array' and jsonb_array_length(${t.steps}) between 1 and 20`,
    ),
  ],
);
export const programOccurrences = pgTable(
  "training_program_occurrences",
  {
    ...ownedColumns(),
    programId: uuid("program_id").notNull(),
    sequence: integer("sequence").notNull(),
    cycle: integer("cycle").notNull(),
    position: integer("position").notNull(),
    stepId: uuid("step_id").notNull(),
    workoutTitleSnapshot: text("workout_title_snapshot").notNull(),
    plannedDate: date("planned_date"),
    skippedAt: instant("skipped_at"),
    planId: uuid("plan_id").references(() => strengthPlans.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.programId],
      foreignColumns: [trainingPrograms.userId, trainingPrograms.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.userId, t.planId],
      foreignColumns: [strengthPlans.userId, strengthPlans.id],
    }),
    unique("program_occurrence_sequence").on(t.userId, t.programId, t.sequence),
    unique("program_occurrence_plan").on(t.planId),
    index("program_occurrence_owner_created").on(
      t.userId,
      t.programId,
      t.createdAt,
      t.id,
    ),
    check(
      "program_occurrence_fields",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt}) and (${t.skippedAt} is null or isfinite(${t.skippedAt})) and (${t.plannedDate} is null or isfinite(${t.plannedDate})) and ${t.sequence} between 0 and 1000000 and ${t.cycle} between 1 and 1000001 and ${t.position} between 0 and 19 and char_length(btrim(${t.workoutTitleSnapshot})) between 1 and 160`,
    ),
  ],
);
