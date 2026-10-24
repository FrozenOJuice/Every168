import {
  measurementsFor,
  normalizeMeasurementOverride,
} from "@168hours/contracts";
import type { ExerciseDraft } from "./strength-draft";
export const plannedTargetKeys = [
  "targetReps",
  "targetWeightKg",
  "targetDurationSeconds",
  "targetDistanceMeters",
  "targetLaps",
] as const;
export function hasCustomSetSettings(exercise: ExerciseDraft) {
  return (
    exercise.sets.some(
      (set) =>
        !!normalizeMeasurementOverride(
          set.measurementOverride,
          exercise.loggingType ?? "reps_load",
        ),
    ) ||
    plannedTargetKeys.some((key) =>
      exercise.sets.some((set) => set[key] !== exercise.sets[0]?.[key]),
    ) ||
    exercise.sets
      .slice(0, -1)
      .some((set) => set.restSeconds !== exercise.sets[0]?.restSeconds)
  );
}
/** Prepare an explicit reset proposal; never change the live draft before confirmation. */
export function basicResetProposal(exercise: ExerciseDraft): ExerciseDraft {
  const active = measurementsFor(exercise.loggingType ?? "reps_load");
  const keys = {
    reps: "targetReps",
    load: "targetWeightKg",
    duration: "targetDurationSeconds",
    distance: "targetDistanceMeters",
    laps: "targetLaps",
  } as const;
  const selectedKeys: readonly string[] = active.map((field) => keys[field]);
  const shared = Object.fromEntries(
    plannedTargetKeys.map((key) => [
      key,
      selectedKeys.includes(key) &&
      exercise.sets.every((set) => set[key] === exercise.sets[0]?.[key])
        ? (exercise.sets[0]?.[key] ?? null)
        : null,
    ]),
  );
  const rest = exercise.sets
    .slice(0, -1)
    .every((set) => set.restSeconds === exercise.sets[0]?.restSeconds)
    ? (exercise.sets[0]?.restSeconds ?? null)
    : null;
  return {
    ...exercise,
    sets: exercise.sets.map((set, index) => ({
      ...set,
      ...shared,
      measurementOverride: null,
      restSeconds: index < exercise.sets.length - 1 ? rest : null,
    })),
  };
}
