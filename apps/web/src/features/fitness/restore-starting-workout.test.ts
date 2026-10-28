import { expect, it } from "vitest";
import type { WorkoutStartingSetup } from "@168hours/contracts";
import { emptySet, type SessionDraft } from "./strength-draft";
import {
  restoreStartingWorkout,
  startingSetupChanged,
  undoStartingRestore,
} from "./restore-starting-workout";
import { removedResults } from "./session-removals";
const original: WorkoutStartingSetup = {
  title: "Leg day",
  notes: "Starting notes",
  exercises: [
    {
      id: "e1",
      exerciseId: "squat",
      exerciseNameSnapshot: "Squat",
      loggingType: "reps_load",
      intentTags: [],
      notes: null,
      sets: ["s1", "s2"].map((id) => ({
        id,
        targetReps: 8,
        targetWeightKg: 40,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetLaps: null,
        restSeconds: null,
        measurementOverride: null,
      })),
    },
  ],
};
function current(): SessionDraft {
  return {
    title: "Changed",
    notes: "New notes",
    startedAt: "2026-10-26T12:00:00Z",
    endedAt: null,
    linkedTimeBlockId: null,
    exercises: [
      {
        id: "e1",
        clientKey: "e1",
        exerciseId: "squat",
        name: "Squat",
        loggingType: "reps_load",
        notes: null,
        sets: [
          {
            ...emptySet(),
            id: "s1",
            clientKey: "s1",
            targetReps: 12,
            targetWeightKg: 50,
            reps: 10,
            weightKg: 45,
            completed: true,
          },
          {
            ...emptySet(),
            id: "extra",
            clientKey: "extra",
            completed: true,
            reps: 6,
          },
        ],
      },
    ],
  };
}
it("restores setup and missing original sets, preserving occurrence results and timing", () => {
  const before = current();
  const restored = restoreStartingWorkout(before, original);
  expect(startingSetupChanged(before, original)).toBe(true);
  expect(restored.title).toBe("Leg day");
  expect(restored.startedAt).toBe(before.startedAt);
  expect(restored.exercises[0]!.sets[0]).toMatchObject({
    id: "s1",
    targetReps: 8,
    targetWeightKg: 40,
    reps: 10,
    weightKg: 45,
    completed: true,
  });
  expect(restored.exercises[0]!.sets[1]).toMatchObject({
    id: "s2",
    reps: null,
    completed: false,
  });
  expect(removedResults(before.exercises, restored.exercises)).toBe(1);
  expect(startingSetupChanged(restored, original)).toBe(false);
});
it("undo preserves the previous results and strips IDs only from removed occurrences", () => {
  const before = current();
  const restored = restoreStartingWorkout(before, original);
  const undo = undoStartingRestore(before, restored);
  expect(undo.title).toBe(before.title);
  expect(undo.exercises[0]!.sets[0]!.id).toBe("s1");
  expect(undo.exercises[0]!.sets[1]).toMatchObject({
    id: undefined,
    clientKey: "extra",
    reps: 6,
    completed: true,
  });
});
it("does not transfer results between duplicated exercises or reordered sets", () => {
  const before = current();
  before.exercises.unshift({
    ...before.exercises[0]!,
    id: "duplicate",
    clientKey: "duplicate",
    sets: [{ ...emptySet(), id: "other", reps: 99 }],
  });
  before.exercises[1]!.sets.reverse();
  expect(
    restoreStartingWorkout(before, original).exercises[0]!.sets[0]!.reps,
  ).toBe(10);
});
