import {
  exerciseLoggingTypeSchema,
  measurementsFor,
  type ExerciseLoggingType,
  type ExerciseMeasurement,
} from "@168hours/contracts";
export type { ExerciseMeasurement } from "@168hours/contracts";
export const exerciseTrackingFields = Object.fromEntries(
  exerciseLoggingTypeSchema.options.map((type) => [
    type,
    measurementsFor(type),
  ]),
) as Record<ExerciseLoggingType, ExerciseMeasurement[]>;
