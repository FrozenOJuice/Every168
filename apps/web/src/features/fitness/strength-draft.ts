import {
  setInput,
  type Workout,
  type WorkoutUpdateInput,
  type StrengthPlan,
  type StrengthPlanInput,
  type SetInput,
  type ExerciseLoggingType,
} from "@168hours/contracts";
export type SetDraft = SetInput & { id?: string; clientKey?: string };
export type ExerciseDraft = {
  id?: string;
  clientKey?: string;
  exerciseId: string;
  name: string;
  loggingType?: ExerciseLoggingType;
  intentTags?: string[];
  notes: string | null;
  sets: SetDraft[];
};
export const emptySet = (): SetDraft => ({
  ...setInput.parse({ completed: false }),
  clientKey: crypto.randomUUID(),
});
/** A new planned set reuses targets, never recorded results or identity. */
export function nextPlannedSet(previous?: SetDraft): SetDraft {
  return {
    ...emptySet(),
    targetReps: previous?.targetReps ?? null,
    targetWeightKg: previous?.targetWeightKg ?? null,
    targetDurationSeconds: previous?.targetDurationSeconds ?? null,
    targetDistanceMeters: previous?.targetDistanceMeters ?? null,
    targetLaps: previous?.targetLaps ?? null,
    restSeconds: previous?.restSeconds ?? null,
  };
}
export function sessionDraft(w: Workout): SessionDraft {
  return {
    title: w.title,
    notes: w.notes,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    linkedTimeBlockId: w.linkedTimeBlockId,
    exercises: w.exercises.map((e) => ({
      ...e,
      clientKey: e.id,
      name: e.exerciseNameSnapshot,
      sets: e.sets.map((s) => ({ ...s, clientKey: s.id })),
    })),
  };
}
export type SessionDraft = Omit<WorkoutUpdateInput, "exercises"> & {
  exercises: ExerciseDraft[];
};
export function sessionInput(v: SessionDraft): WorkoutUpdateInput {
  return {
    ...v,
    exercises: v.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      loggingType: e.loggingType,
      intentTags: e.intentTags,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        id: s.id,
        reps: s.reps,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        distanceMeters: s.distanceMeters,
        laps: s.laps,
        completed: s.completed,
        skipped: s.skipped,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceMeters: s.targetDistanceMeters,
        targetLaps: s.targetLaps,
        restSeconds: s.restSeconds,
      })),
    })),
  };
}
export function planExercises(plan?: StrengthPlan): ExerciseDraft[] {
  return (
    plan?.exercises.map((e) => ({
      ...e,
      clientKey: crypto.randomUUID(),
      sets: e.sets.map((s) => ({ ...emptySet(), ...s })),
    })) ?? []
  );
}
export function planInput(
  title: string,
  notes: string | null,
  exercises: ExerciseDraft[],
  fromActual = false,
): StrengthPlanInput {
  return {
    title,
    notes,
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      loggingType: e.loggingType,
      intentTags: e.intentTags,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        targetReps: s.targetReps ?? (fromActual ? s.reps : null),
        targetWeightKg: s.targetWeightKg ?? (fromActual ? s.weightKg : null),
        targetDurationSeconds:
          s.targetDurationSeconds ?? (fromActual ? s.durationSeconds : null),
        targetDistanceMeters:
          s.targetDistanceMeters ?? (fromActual ? s.distanceMeters : null),
        targetLaps: s.targetLaps ?? (fromActual ? s.laps : null),
        restSeconds: s.restSeconds,
      })),
    })),
  };
}
export function moveTo<T>(values: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= values.length ||
    to >= values.length
  )
    return values;
  const next = [...values];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
export function move<T>(values: T[], index: number, delta: number) {
  return moveTo(values, index, index + delta);
}
