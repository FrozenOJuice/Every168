import {
  measurementsFor,
  type Exercise,
  type ProgressSession,
  type WorkoutRecords,
} from "@168hours/contracts";
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

/** Report rows carry actual values and captured fields, never planned targets. */
export function progressSessionSummary(
  exercise: Pick<Exercise, "id" | "name" | "loggingType">,
  session: ProgressSession,
  units: Parameters<typeof actualExerciseSummary>[1],
) {
  return actualExerciseSummary(
    {
      exerciseId: exercise.id,
      name: exercise.name,
      notes: null,
      loggingType: exercise.loggingType,
      sets: session.sets.map((set) => ({
        ...set,
        completed: set.completed ?? true,
        skipped: set.skipped ?? false,
        resultsEdited: true,
        measurementOverride: set.loggingType ?? exercise.loggingType,
        targetReps: null,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetLaps: null,
        restSeconds: null,
      })),
    },
    units,
  );
}

/** An exercise with no completed results should state its outcome, not imply missing data. */
export function summaryExerciseOutcome(
  exercise: Pick<ExerciseDraft, "sets">,
): string | null {
  const completed = exercise.sets.some((set) => set.completed && !set.skipped);
  if (completed) return null;
  if (!exercise.sets.length) return "No sets recorded";
  const skipped = exercise.sets.filter((set) => set.skipped).length;
  const unfinished = exercise.sets.length - skipped;
  if (!unfinished) return "Skipped";
  if (!skipped) return "Unfinished";
  return `${skipped} skipped · ${unfinished} unfinished`;
}

/** Keep highlights attached to completed sets in this occurrence, including repeated exercises. */
export function summaryRecordHighlights(
  exercise: ExerciseDraft,
  records: WorkoutRecords["records"],
) {
  const ids = new Set(
    exercise.sets
      .filter((set) => set.completed && !set.skipped)
      .map((set) => set.id)
      .filter(Boolean),
  );
  const eligible = records.filter(
    (record) =>
      ids.has(record.setId) &&
      (!exercise.id || record.workoutExerciseId === exercise.id),
  );
  const highlights: { label: string; performance: boolean; first: boolean }[] =
    [];
  if (eligible.length && eligible.every((record) => record.first))
    return [
      { label: "First recorded result", performance: false, first: true },
    ];
  const improvements = new Set(
    eligible
      .filter(
        (record) =>
          !record.first &&
          ["load", "reps", "repsAtWeight"].includes(record.metric),
      )
      .map(
        (record) =>
          `${record.metric}:${record.metric === "repsAtWeight" ? record.weightKg : ""}`,
      ),
  );
  if (improvements.size)
    highlights.push({
      label:
        improvements.size === 1
          ? "New record"
          : `${improvements.size} new records`,
      performance: true,
      first: false,
    });
  for (const metric of ["distance", "duration"] as const) {
    if (eligible.some((record) => record.metric === metric && !record.first))
      highlights.push({
        label: `Longest recorded ${metric}`,
        performance: false,
        first: false,
      });
  }
  return highlights;
}
