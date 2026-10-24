import { expect, it } from "vitest";
import { emptySet } from "./strength-draft";
import {
  basicResetProposal,
  hasCustomSetSettings,
} from "./workout-basic-settings";
it("detects overrides and differences, excluding the final set's unused rest", () => {
  const first = { ...emptySet(), targetReps: 8, restSeconds: 60 };
  const exercise = {
    exerciseId: "id",
    name: "Squat",
    notes: null,
    sets: [first, { ...first, restSeconds: null }],
  };
  expect(hasCustomSetSettings(exercise)).toBe(false);
  expect(
    hasCustomSetSettings({
      ...exercise,
      sets: [{ ...first, measurementOverride: "reps_load" }, first],
    }),
  ).toBe(false);
  expect(
    hasCustomSetSettings({
      ...exercise,
      sets: [first, { ...first, targetReps: 10 }],
    }),
  ).toBe(true);
  expect(
    hasCustomSetSettings({
      ...exercise,
      sets: [{ ...first, measurementOverride: "duration" }, first],
    }),
  ).toBe(true);
  expect(
    hasCustomSetSettings({
      ...exercise,
      sets: [first, { ...first, restSeconds: 90 }, first],
    }),
  ).toBe(true);
});
it("prepares a shared reset without mutating the original or losing identity, notes or actuals", () => {
  const first = {
    ...emptySet(),
    targetReps: 8,
    targetWeightKg: 20,
    restSeconds: 60,
    reps: 7,
    completed: true,
  };
  const second = {
    ...emptySet(),
    targetReps: 10,
    targetWeightKg: 20,
    measurementOverride: "duration" as const,
  };
  const exercise = {
    exerciseId: "id",
    name: "Squat",
    notes: "Keep note",
    intentTags: ["strength"],
    sets: [first, second],
  };
  const proposal = basicResetProposal(exercise);
  expect(proposal.sets).toHaveLength(2);
  expect(proposal.sets[0]).toMatchObject({
    clientKey: first.clientKey,
    targetReps: null,
    targetWeightKg: 20,
    restSeconds: 60,
    reps: 7,
    completed: true,
    measurementOverride: null,
  });
  expect(proposal.sets[1]).toMatchObject({
    targetReps: null,
    targetWeightKg: 20,
    restSeconds: null,
    measurementOverride: null,
  });
  expect(proposal.notes).toBe("Keep note");
  expect(proposal.intentTags).toEqual(["strength"]);
  expect(hasCustomSetSettings(proposal)).toBe(false);
  expect(exercise.sets[1]!.measurementOverride).toBe("duration");
  expect(exercise.sets[0]!.targetReps).toBe(8);
});
