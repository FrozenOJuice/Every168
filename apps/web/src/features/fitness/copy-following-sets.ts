import { measurementsFor, plannedSetInput } from "@168hours/contracts";
import type { ExerciseDraft } from "./strength-draft";

export type SetCopyKind = "targets" | "rest";
const targets = {
  reps: "targetReps",
  load: "targetWeightKg",
  duration: "targetDurationSeconds",
  distance: "targetDistanceMeters",
  laps: "targetLaps",
} as const;

/** Copy prescriptions, retaining each destination's selection, identity and results. */
export function copyFollowingSets(
  exercise: ExerciseDraft,
  index: number,
  kind: SetCopyKind,
) {
  const source = exercise.sets[index];
  if (!source) return { exercise, count: 0 };
  const loggingType = exercise.loggingType ?? "reps_load";
  if (
    kind === "rest" &&
    !plannedSetInput.shape.restSeconds.safeParse(source.restSeconds).success
  )
    return { exercise, count: 0 };
  const fields = measurementsFor(
    source.measurementOverride ?? loggingType,
  ).filter((field) => {
    const key = targets[field];
    return (
      source[key] !== null &&
      plannedSetInput.shape[key].safeParse(source[key]).success
    );
  });
  let count = 0;
  const sets = exercise.sets.map((set, i) => {
    if (i <= index) return set;
    if (kind === "rest") {
      if (
        i === exercise.sets.length - 1 ||
        set.restSeconds === source.restSeconds
      )
        return set;
      count++;
      return { ...set, restSeconds: source.restSeconds };
    }
    const selected = measurementsFor(set.measurementOverride ?? loggingType);
    const next = { ...set };
    for (const field of fields) {
      const key = targets[field];
      const value = source[key];
      if (selected.includes(field)) next[key] = value;
    }
    if (fields.every((field) => next[targets[field]] === set[targets[field]]))
      return set;
    count++;
    return next;
  });
  return { exercise: count ? { ...exercise, sets } : exercise, count };
}
