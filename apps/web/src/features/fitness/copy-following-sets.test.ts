import { expect, it } from "vitest";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import { copyFollowingSets } from "./copy-following-sets";

const example = (): ExerciseDraft => ({
  exerciseId: "practice",
  name: "Practice",
  notes: "Retain notes",
  loggingType: "reps_load",
  sets: [
    {
      ...emptySet(),
      targetReps: 8,
      targetWeightKg: 0,
      targetDurationSeconds: 60,
    },
    {
      ...emptySet(),
      targetReps: 12,
      targetWeightKg: 80,
      reps: 10,
      completed: true,
      restSeconds: 90,
    },
    {
      ...emptySet(),
      measurementOverride: "duration",
      targetDurationSeconds: 45,
      targetReps: 12,
      skipped: true,
    },
    {
      ...emptySet(),
      measurementOverride: "load",
      targetWeightKg: 100,
      restSeconds: 42,
    },
  ],
});

it("copies only filled active targets shared by each following set, preserving all other data", () => {
  const original = example();
  const result = copyFollowingSets(original, 0, "targets");
  expect(result.count).toBe(2);
  expect(result.exercise.sets).toEqual([
    original.sets[0],
    { ...original.sets[1], targetReps: 8, targetWeightKg: 0 },
    original.sets[2],
    { ...original.sets[3], targetWeightKg: 0 },
  ]);
  expect(result.exercise.notes).toBe(original.notes);
  expect(original.sets[1]!.targetReps).toBe(12);
  expect(copyFollowingSets(result.exercise, 0, "targets").count).toBe(0);
});

it("never clears a destination from blank or invalid source targets or changes earlier sets", () => {
  const original = example();
  original.sets[1]!.targetReps = null;
  original.sets[1]!.targetWeightKg = -1;
  expect(copyFollowingSets(original, 1, "targets")).toEqual({
    exercise: original,
    count: 0,
  });
  expect(copyFollowingSets(original, -1, "targets").count).toBe(0);
  expect(copyFollowingSets(original, 3, "targets").count).toBe(0);
});

it("copies unset, explicit zero and timed rest only to following between-set intervals", () => {
  for (const restSeconds of [null, 0, 75]) {
    const original = example();
    original.sets[0]!.restSeconds = restSeconds;
    original.sets[2]!.restSeconds = 30;
    const result = copyFollowingSets(original, 0, "rest");
    expect(result.count).toBe(2);
    expect(result.exercise.sets).toEqual([
      original.sets[0],
      { ...original.sets[1], restSeconds },
      { ...original.sets[2], restSeconds },
      original.sets[3],
    ]);
  }
  const original = example();
  original.sets[0]!.restSeconds = -1;
  expect(copyFollowingSets(original, 0, "rest").count).toBe(0);
  expect(copyFollowingSets(original, 2, "rest").count).toBe(0);
});
