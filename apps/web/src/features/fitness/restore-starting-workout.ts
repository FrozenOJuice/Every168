import { setInput, type WorkoutStartingSetup } from "@168hours/contracts";
import type { SessionDraft, ExerciseDraft } from "./strength-draft";

const identity = (v: { id?: string; clientKey?: string }) =>
  v.id ?? v.clientKey;

/** Keep results attached to the same occurrence, never to its array position. */
export function restoreStartingWorkout(
  current: SessionDraft,
  starting: WorkoutStartingSetup,
): SessionDraft {
  return {
    ...current,
    title: starting.title,
    notes: starting.notes,
    exercises: starting.exercises.map((e) => {
      const existing = current.exercises.find(
        (v) => identity(v) === e.id && v.exerciseId === e.exerciseId,
      );
      return {
        ...e,
        name: e.exerciseNameSnapshot,
        clientKey: existing?.clientKey ?? e.id,
        sets: e.sets.map((s) => {
          const result = existing?.sets.find((v) => identity(v) === s.id);
          return {
            ...setInput.parse({ completed: false }),
            ...result,
            ...s,
            clientKey: result?.clientKey ?? s.id,
          };
        }),
      };
    }),
  };
}

function setup(v: SessionDraft) {
  return JSON.stringify({
    title: v.title,
    notes: v.notes,
    exercises: v.exercises.map((e) => ({
      id: identity(e),
      exerciseId: e.exerciseId,
      loggingType: e.loggingType,
      intentTags: e.intentTags ?? [],
      notes: e.notes,
      sets: e.sets.map((s) => ({
        id: identity(s),
        measurementOverride: s.measurementOverride ?? null,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceMeters: s.targetDistanceMeters,
        targetLaps: s.targetLaps,
        restSeconds: s.restSeconds,
      })),
    })),
  });
}
export function startingSetupChanged(
  current: SessionDraft,
  starting: WorkoutStartingSetup,
) {
  return setup(current) !== setup(restoreStartingWorkout(current, starting));
}

/** Removed non-starting occurrences need fresh server identities on undo. */
export function undoStartingRestore(
  before: SessionDraft,
  current: SessionDraft,
): SessionDraft {
  const exercises: ExerciseDraft[] = before.exercises.map((e) => {
    const kept = current.exercises.find(
      (v) => (v.clientKey ?? v.id) === (e.clientKey ?? e.id),
    );
    return {
      ...e,
      id: kept?.id,
      sets: e.sets.map((s) => ({
        ...s,
        id: kept?.sets.find(
          (v) => (v.clientKey ?? v.id) === (s.clientKey ?? s.id),
        )?.id,
      })),
    };
  });
  return { ...current, title: before.title, notes: before.notes, exercises };
}
