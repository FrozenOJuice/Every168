import {
  normalizeMeasurementOverride,
  type StrengthPlanInput,
} from "@168hours/contracts";

/** Compare reusable setup, not occurrence IDs, results, timestamps or display units. */
export function workoutCopySignature(
  value: Pick<StrengthPlanInput, "title" | "notes" | "exercises">,
) {
  return JSON.stringify({
    title: value.title.trim(),
    notes: value.notes?.trim() || null,
    exercises: value.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      loggingType: exercise.loggingType ?? "reps_load",
      intentTags: [...(exercise.intentTags ?? [])].sort(),
      notes: exercise.notes?.trim() || null,
      sets: exercise.sets.map((set) => ({
        measurementOverride: normalizeMeasurementOverride(
          set.measurementOverride,
          exercise.loggingType ?? "reps_load",
        ),
        targetReps: set.targetReps ?? null,
        targetWeightKg: set.targetWeightKg ?? null,
        targetDurationSeconds: set.targetDurationSeconds ?? null,
        targetDistanceMeters: set.targetDistanceMeters ?? null,
        targetLaps: set.targetLaps ?? null,
        restSeconds: set.restSeconds ?? null,
      })),
    })),
  });
}
