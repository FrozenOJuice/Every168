import { z } from "zod";
import {
  recordSchema,
  titleSchema,
  notesSchema,
  idSchema,
  instantSchema,
  pageSchema,
  pageQuerySchema,
} from "./common";
export const exerciseInput = z
  .object({ name: titleSchema, notes: notesSchema })
  .strict();
export const exerciseSchema = recordSchema.extend({
  ...exerciseInput.shape,
  archivedAt: instantSchema.nullable(),
});
export const setInput = z
  .object({
    reps: z.number().int().positive().max(10000).nullable().default(null),
    weightKg: z.number().finite().min(0).max(2000).nullable().default(null),
    durationSeconds: z
      .number()
      .int()
      .positive()
      .max(86400)
      .nullable()
      .default(null),
    completed: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.reps !== null || v.durationSeconds !== null, {
    path: ["reps"],
    message: "Enter reps or a timed duration.",
  });
export const workoutExerciseInput = z
  .object({
    id: idSchema.optional(),
    exerciseId: idSchema,
    notes: notesSchema,
    sets: z.array(setInput.safeExtend({ id: idSchema.optional() })).max(100),
  })
  .strict();
export const workoutStartInput = z
  .object({
    title: titleSchema.default("Strength workout"),
    startedAt: instantSchema,
    notes: notesSchema,
    linkedTimeBlockId: idSchema.nullable().default(null),
  })
  .strict();
export const workoutUpdateInput = workoutStartInput
  .extend({
    endedAt: instantSchema.nullable(),
    exercises: z.array(workoutExerciseInput).max(50),
  })
  .refine(
    (v) =>
      v.endedAt === null ||
      (Date.parse(v.endedAt) > Date.parse(v.startedAt) &&
        Date.parse(v.endedAt) - Date.parse(v.startedAt) <= 31 * 86400000),
    {
      path: ["endedAt"],
      message: "Finish must be after start and within 31 days.",
    },
  )
  .refine(
    (v) =>
      v.endedAt === null ||
      v.exercises.some((e) => e.sets.some((s) => s.completed)),
    {
      path: ["exercises"],
      message: "Record at least one completed set before finishing.",
    },
  );
export const workoutSummarySchema = recordSchema.extend({
  ...workoutStartInput.shape,
  endedAt: instantSchema.nullable(),
});
export const setSchema = recordSchema.extend({
  ...setInput.shape,
  position: z.number(),
});
export const workoutSchema = workoutSummarySchema.extend({
  exercises: z.array(
    z.object({
      id: idSchema,
      exerciseId: idSchema,
      exerciseNameSnapshot: z.string(),
      position: z.number(),
      notes: z.string().nullable(),
      sets: z.array(setSchema),
    }),
  ),
});
export const cardioInput = z
  .object({
    activityType: z.enum(["run", "walk", "swim", "cycle", "skip", "other"]),
    title: titleSchema.default("Cardio activity"),
    startedAt: instantSchema,
    durationSeconds: z
      .number()
      .int()
      .positive()
      .max(31 * 86400),
    distanceMeters: z
      .number()
      .finite()
      .positive()
      .max(10000000)
      .nullable()
      .default(null),
    notes: notesSchema,
    linkedTimeBlockId: idSchema.nullable().default(null),
  })
  .strict();
export const cardioSchema = recordSchema.extend({
  ...cardioInput.shape,
  paceSecondsPerKm: z.number().nullable(),
});
export const workoutHistoryQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  status: z.enum(["all", "active", "completed"]).default("all"),
});
export const cardioHistoryQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  activityType: cardioInput.shape.activityType.optional(),
});
export type WorkoutHistoryQuery = z.infer<typeof workoutHistoryQuery>;
export type CardioHistoryQuery = z.infer<typeof cardioHistoryQuery>;
export const progressSetSchema = z.object({
  id: idSchema,
  createdAt: instantSchema,
  startedAt: instantSchema,
  workoutId: idSchema,
  exerciseNameSnapshot: z.string(),
  reps: z.number().nullable(),
  weightKg: z.number().nullable(),
  durationSeconds: z.number().nullable(),
});
export const strengthProgressSchema = z.object({
  exercise: exerciseSchema,
  maxWeightKg: z.number().nullable(),
  history: pageSchema(progressSetSchema),
});
export type ExerciseInput = z.infer<typeof exerciseInput>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type SetInput = z.infer<typeof setInput>;
export type WorkoutStartInput = z.infer<typeof workoutStartInput>;
export type WorkoutUpdateInput = z.infer<typeof workoutUpdateInput>;
export type Workout = z.infer<typeof workoutSchema>;
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;
export type CardioInput = z.infer<typeof cardioInput>;
export type Cardio = z.infer<typeof cardioSchema>;
export type StrengthProgress = z.infer<typeof strengthProgressSchema>;
