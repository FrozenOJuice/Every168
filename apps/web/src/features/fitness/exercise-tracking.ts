import type { ExerciseLoggingType } from "@168hours/contracts";
export type ExerciseMeasurement =
  "reps" | "load" | "duration" | "distance" | "laps";
export const exerciseTrackingFields: Record<
  ExerciseLoggingType,
  ExerciseMeasurement[]
> = {
  reps_load: ["reps", "load"],
  reps: ["reps"],
  duration: ["duration"],
  duration_load: ["duration", "load"],
  distance_duration: ["distance", "duration"],
  laps_duration: ["laps", "duration"],
};
