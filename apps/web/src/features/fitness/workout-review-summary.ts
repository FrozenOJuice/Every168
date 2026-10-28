import { measurementsFor } from "@168hours/contracts";
import type { ExerciseDraft } from "./strength-draft";
import { workoutExerciseSummary } from "./workout-exercise-summary";
export function actualExerciseSummary(
  exercise: ExerciseDraft,
  units: Parameters<typeof workoutExerciseSummary>[1],
  setUnits?: Parameters<typeof workoutExerciseSummary>[1][],
) {
  const completed = exercise.sets.flatMap((set, index) =>
    set.completed && !set.skipped
      ? [{ set, units: setUnits?.[index] ?? units }]
      : [],
  );
  const sets = completed.map(({ set }) => ({
    ...set,
    targetReps: set.reps,
    targetWeightKg: set.weightKg,
    targetDurationSeconds: set.durationSeconds,
    targetDistanceMeters: set.distanceMeters,
    targetLaps: set.laps,
  }));
  if (!sets.length) return "No completed sets";
  const missing = sets.some((set) =>
    measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    ).some(
      (field) =>
        set[
          (
            {
              reps: "reps",
              load: "weightKg",
              duration: "durationSeconds",
              distance: "distanceMeters",
              laps: "laps",
            } as const
          )[field]
        ] === null,
    ),
  );
  const summary = sets.length
    ? workoutExerciseSummary(
        { ...exercise, sets },
        units,
        false,
        completed.map((item) => item.units),
      ).replace("Some targets unset", "Some results not recorded")
    : "No completed sets";
  return missing && !summary.includes("Some results not recorded")
    ? `${summary} | Some results not recorded`
    : summary;
}
