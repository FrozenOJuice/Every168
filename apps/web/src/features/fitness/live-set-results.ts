import {
  measurementsFor,
  setInput,
  type ExerciseLoggingType,
} from "@168hours/contracts";
import type { SetDraft } from "./strength-draft";

export const actualKeys = {
  reps: "reps",
  load: "weightKg",
  duration: "durationSeconds",
  distance: "distanceMeters",
  laps: "laps",
} as const;
const targetKeys = {
  reps: "targetReps",
  load: "targetWeightKg",
  duration: "targetDurationSeconds",
  distance: "targetDistanceMeters",
  laps: "targetLaps",
} as const;

/** Untouched sets offer their selected targets for explicit confirmation only.
 * Once results exist, missing results remain unknown rather than being filled. */
export function liveSetResults(
  set: SetDraft,
  mode: ExerciseLoggingType,
): SetDraft {
  if (
    set.completed ||
    set.resultsEdited ||
    Object.values(actualKeys).some((key) => set[key] !== null)
  )
    return set;
  const result = { ...set };
  for (const field of measurementsFor(set.measurementOverride ?? mode)) {
    result[actualKeys[field]] = set[targetKeys[field]];
  }
  return result;
}

export function canCompleteLiveSet(set: SetDraft) {
  return setInput.safeParse({
    ...Object.fromEntries(
      Object.keys(setInput.shape).map((key) => [
        key,
        set[key as keyof SetDraft],
      ]),
    ),
    completed: true,
    skipped: false,
  }).success;
}
