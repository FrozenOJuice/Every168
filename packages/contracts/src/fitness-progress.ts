import { z } from "zod";
import {
  dateSchema,
  idSchema,
  instantSchema,
  pageQuerySchema,
  pageSchema,
} from "./common";
import { exerciseSchema, exerciseLoggingTypeSchema } from "./exercise";

export const fitnessProgressQuery = z.object({ date: dateSchema.optional() });
export const exerciseReportQuery = pageQuerySchema.extend({
  loggingType: exerciseLoggingTypeSchema.optional(),
  excludeWorkoutId: idSchema.optional(),
  before: instantSchema.optional(),
});
export type ExerciseReportQuery = z.infer<typeof exerciseReportQuery>;
export const strengthMetricsSchema = z.object({
  completedSets: z.number().int().nonnegative(),
  maxReps: z.number().nullable(),
  maxWeightKg: z.number().nullable(),
  maxDurationSeconds: z.number().nullable(),
  maxDistanceMeters: z.number().nullable(),
  maxLaps: z.number().nullable(),
  volumeKg: z.number().nullable(),
  missingVolumeSets: z.number().int().nonnegative(),
});
export type StrengthMetrics = z.infer<typeof strengthMetricsSchema>;
export const progressSessionSchema = strengthMetricsSchema.extend({
  id: idSchema,
  title: z.string(),
  startedAt: instantSchema,
  endedAt: instantSchema,
});
export type ProgressSession = z.infer<typeof progressSessionSchema>;
export const progressRecordSchema = z.object({
  metric: z.enum(["load", "reps", "duration", "distance", "laps", "setVolume"]),
  value: z.number(),
  workoutId: idSchema,
  workoutTitle: z.string(),
  startedAt: instantSchema,
  setId: idSchema,
  reps: z.number().nullable(),
  weightKg: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  distanceMeters: z.number().nullable(),
  laps: z.number().nullable(),
});
export const exerciseReportSchema = z.object({
  exercise: exerciseSchema,
  loggingType: exerciseLoggingTypeSchema,
  records: z.array(progressRecordSchema),
  sessions: pageSchema(progressSessionSchema),
});
export type ExerciseReport = z.infer<typeof exerciseReportSchema>;
export const fitnessWeekSchema = z.object({
  weekStart: dateSchema,
  workoutCount: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  completedSets: z.number().int().nonnegative(),
  volumeKg: z.number().nullable(),
  missingVolumeSets: z.number().int().nonnegative(),
});
export const fitnessOverviewSchema = z.object({
  timezone: z.string(),
  weekStart: dateSchema,
  weeks: z.array(fitnessWeekSchema),
});
export type FitnessOverview = z.infer<typeof fitnessOverviewSchema>;
export const progressExerciseQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
});
export type ProgressExerciseQuery = z.infer<typeof progressExerciseQuery>;
export const progressExerciseSchema = z.object({
  id: idSchema,
  name: z.string(),
  archived: z.boolean(),
});
export type ProgressExercise = z.infer<typeof progressExerciseSchema>;
const comparisonWorkoutSchema = z.object({
  id: idSchema,
  title: z.string(),
  startedAt: instantSchema,
  endedAt: instantSchema.nullable(),
  durationSeconds: z.number().nullable(),
  exercises: z.array(
    strengthMetricsSchema.extend({
      exerciseId: idSchema,
      name: z.string(),
      loggingType: exerciseLoggingTypeSchema,
    }),
  ),
});
export const workoutComparisonSchema = z.object({
  current: comparisonWorkoutSchema,
  previous: comparisonWorkoutSchema.nullable(),
});
export type WorkoutComparison = z.infer<typeof workoutComparisonSchema>;
