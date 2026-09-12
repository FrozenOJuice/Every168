import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
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
import { timeBlocks } from "../planning/planning.table.js";
export const exercises = pgTable(
  "exercises",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    notes: text("notes"),
    archivedAt: instant("archived_at"),
  },
  (t) => [
    check(
      "exercises_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "exercise_fields",
      sql`char_length(btrim(${t.name})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
    unique("exercise_owner_id").on(t.userId, t.id),
    index("exercise_user_created_idx").on(t.userId, t.createdAt, t.id),
  ],
);
export const strengthWorkouts = pgTable(
  "strength_workouts",
  {
    ...ownedColumns(),
    title: text("title").notNull(),
    startedAt: instant("started_at").notNull(),
    endedAt: instant("ended_at"),
    notes: text("notes"),
    linkedTimeBlockId: uuid("linked_time_block_id").references(
      () => timeBlocks.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    check(
      "strengthWorkouts_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "workout_bounds",
      sql`isfinite(${t.startedAt}) and isfinite(${t.endedAt}) and ${t.endedAt}-${t.startedAt}<=interval '31 days' and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
    foreignKey({
      columns: [t.userId, t.linkedTimeBlockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
    }),
    unique("workout_owner_id").on(t.userId, t.id),
    index("workout_user_created_idx").on(t.userId, t.createdAt, t.id),
    index("workout_user_start_idx").on(t.userId, t.startedAt),
    check("workout_positive_duration", sql`${t.endedAt}>${t.startedAt}`),
  ],
);
export const workoutExercises = pgTable(
  "strength_workout_exercises",
  {
    ...ownedColumns(),
    workoutId: uuid("workout_id").notNull(),
    exerciseId: uuid("exercise_id").notNull(),
    exerciseNameSnapshot: text("exercise_name_snapshot").notNull(),
    position: integer("position").notNull(),
    notes: text("notes"),
  },
  (t) => [
    check(
      "workoutExercises_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "workout_exercise_fields",
      sql`${t.position} between 0 and 49 and char_length(btrim(${t.exerciseNameSnapshot})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
    unique("workout_exercise_position").on(t.userId, t.workoutId, t.position),
    unique("workout_exercise_owner_id").on(t.userId, t.id),
    foreignKey({
      columns: [t.userId, t.workoutId],
      foreignColumns: [strengthWorkouts.userId, strengthWorkouts.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.userId, t.exerciseId],
      foreignColumns: [exercises.userId, exercises.id],
    }),
    index("workout_exercise_parent_idx").on(t.userId, t.workoutId),
    index("workout_exercise_progress_idx").on(t.userId, t.exerciseId),
  ],
);
export const strengthSets = pgTable(
  "strength_sets",
  {
    ...ownedColumns(),
    workoutExerciseId: uuid("workout_exercise_id").notNull(),
    position: integer("position").notNull(),
    reps: integer("reps"),
    weightKg: doublePrecision("weight_kg"),
    durationSeconds: integer("duration_seconds"),
    completed: boolean("completed").notNull(),
  },
  (t) => [
    check(
      "strengthSets_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "set_bounds",
      sql`${t.position} between 0 and 99 and ${t.reps}<=10000 and ${t.durationSeconds}<=86400 and ${t.weightKg}<=2000`,
    ),
    unique("set_position").on(t.userId, t.workoutExerciseId, t.position),
    foreignKey({
      columns: [t.userId, t.workoutExerciseId],
      foreignColumns: [workoutExercises.userId, workoutExercises.id],
    }).onDelete("cascade"),
    index("set_parent_idx").on(t.userId, t.workoutExerciseId),
    check(
      "set_positive_values",
      sql`(${t.reps} is not null or ${t.durationSeconds} is not null) and (${t.reps} is null or ${t.reps}>0) and (${t.durationSeconds} is null or ${t.durationSeconds}>0) and (${t.weightKg} is null or ${t.weightKg}>=0)`,
    ),
  ],
);
export const cardioActivities = pgTable(
  "cardio_activities",
  {
    ...ownedColumns(),
    activityType: text("activity_type", {
      enum: ["run", "walk", "swim", "cycle", "skip", "other"],
    }).notNull(),
    title: text("title").notNull(),
    startedAt: instant("started_at").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    distanceMeters: doublePrecision("distance_meters"),
    notes: text("notes"),
    linkedTimeBlockId: uuid("linked_time_block_id").references(
      () => timeBlocks.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    check(
      "cardioActivities_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "cardio_bounds",
      sql`${t.activityType} in ('run','walk','swim','cycle','skip','other') and isfinite(${t.startedAt}) and ${t.durationSeconds}<=2678400 and ${t.distanceMeters}<=10000000 and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000`,
    ),
    foreignKey({
      columns: [t.userId, t.linkedTimeBlockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
    }),
    index("cardio_user_created_idx").on(t.userId, t.createdAt, t.id),
    index("cardio_user_start_idx").on(t.userId, t.startedAt),
    check(
      "cardio_positive_values",
      sql`${t.durationSeconds}>0 and (${t.distanceMeters} is null or ${t.distanceMeters}>0)`,
    ),
  ],
);
