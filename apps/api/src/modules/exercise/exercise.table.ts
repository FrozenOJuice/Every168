import type { StrengthPlan } from "@168hours/contracts";
import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
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
    catalogKey: text("catalog_key"),
    equipment: text("equipment")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    muscles: text("muscles")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    check(
      "exercise_metadata",
      sql`cardinality(${t.equipment})<=10 and ${t.equipment} <@ ARRAY['Barbell','Dumbbells','Cable','Machine','Bodyweight','Bench','Kettlebell','Resistance band','Pull-up bar','Other']::text[] and cardinality(${t.muscles})<=6 and ${t.muscles} <@ ARRAY['Chest','Back','Shoulders','Arms','Legs','Core']::text[]`,
    ),
    unique("exercise_owner_id").on(t.userId, t.id),
    unique("exercise_owner_catalog_key").on(t.userId, t.catalogKey),
    index("exercise_user_created_idx").on(t.userId, t.createdAt, t.id),
  ],
);
export const exercisePreferences = pgTable(
  "exercise_preferences",
  {
    ...ownedColumns(),
    exerciseId: uuid("exercise_id").notNull(),
    favourite: boolean("favourite").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => [
    unique("exercise_preference_owner_exercise").on(t.userId, t.exerciseId),
    foreignKey({
      columns: [t.userId, t.exerciseId],
      foreignColumns: [exercises.userId, exercises.id],
    }).onDelete("cascade"),
    check(
      "exercise_preference_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
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
    skipped: boolean("skipped").notNull().default(false),
    targetReps: integer("target_reps"),
    targetWeightKg: doublePrecision("target_weight_kg"),
    targetDurationSeconds: integer("target_duration_seconds"),
    restSeconds: integer("rest_seconds"),
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
      sql`(not ${t.completed} or ${t.reps} is not null or ${t.durationSeconds} is not null) and not (${t.completed} and ${t.skipped}) and (${t.targetReps} is null or ${t.targetReps} between 1 and 10000) and (${t.targetWeightKg} is null or ${t.targetWeightKg} between 0 and 2000) and (${t.targetDurationSeconds} is null or ${t.targetDurationSeconds} between 1 and 86400) and (${t.restSeconds} is null or ${t.restSeconds} between 0 and 3600) and (${t.reps} is null or ${t.reps}>0) and (${t.durationSeconds} is null or ${t.durationSeconds}>0) and (${t.weightKg} is null or ${t.weightKg}>=0)`,
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

export const strengthPlans = pgTable(
  "strength_plans",
  {
    ...ownedColumns(),
    title: text("title").notNull(),
    notes: text("notes"),
    kind: text("kind", { enum: ["workout", "scheduled"] }).notNull(),
    isDraft: boolean("is_draft").notNull().default(false),
    exercises: jsonb("exercises").$type<StrengthPlan["exercises"]>().notNull(),
    timeBlockId: uuid("time_block_id").references(() => timeBlocks.id, {
      onDelete: "set null",
    }),
    sessionId: uuid("session_id").references(() => strengthWorkouts.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.timeBlockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
    }),
    foreignKey({
      columns: [t.userId, t.sessionId],
      foreignColumns: [strengthWorkouts.userId, strengthWorkouts.id],
    }),
    index("strength_plans_owner_created").on(t.userId, t.createdAt, t.id),
    unique("strength_plans_block").on(t.timeBlockId),
    check(
      "strength_plans_fields",
      sql`${t.version}>0 and char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.notes})<=4000 and ${t.kind} in ('workout','scheduled') and jsonb_typeof(${t.exercises})='array' and jsonb_array_length(${t.exercises}) between (case when ${t.isDraft} then 0 else 1 end) and 50 and (not ${t.isDraft} or ${t.kind}='workout') and (${t.kind}='scheduled' or (${t.timeBlockId} is null and ${t.sessionId} is null))`,
    ),
  ],
);
