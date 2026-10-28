import { expect, it } from "vitest";
import { workoutCopySignature } from "./workout-copy-signature";
import { emptySet, planInput, type ExerciseDraft } from "./strength-draft";
const exercise = (): ExerciseDraft => ({
  id: "occurrence",
  clientKey: "local",
  exerciseId: "bench",
  name: "Bench",
  notes: null,
  loggingType: "reps_load",
  intentTags: ["strength", "practice"],
  sets: [{ ...emptySet(), id: "set", targetReps: 12, targetWeightKg: 20 }],
});
const signature = (e: ExerciseDraft) =>
  workoutCopySignature(planInput("Workout", null, [e]));
it("ignores occurrence identity and logged results", () => {
  const e = exercise();
  const original = signature(e);
  e.id = "recreated";
  e.sets[0] = {
    ...e.sets[0]!,
    id: "new-set",
    reps: 10,
    weightKg: 25,
    completed: true,
    resultsEdited: true,
  };
  expect(signature(e)).toBe(original);
});
it("normalizes equivalent notes, tag order and inherited measurements", () => {
  const e = exercise();
  const original = signature(e);
  e.notes = " ";
  e.intentTags!.reverse();
  e.sets[0]!.measurementOverride = "reps_load";
  expect(signature(e)).toBe(original);
});
it("includes targets, rest, measurement choices, notes and exercise order", () => {
  const e = exercise();
  const original = signature(e);
  for (const patch of [
    { targetReps: 10 },
    { restSeconds: 60 },
    { measurementOverride: "reps" as const },
  ]) {
    expect(signature({ ...e, sets: [{ ...e.sets[0]!, ...patch }] })).not.toBe(
      original,
    );
  }
  expect(signature({ ...e, notes: "Pause at the bottom" })).not.toBe(original);
  const other = { ...e, exerciseId: "row" };
  expect(workoutCopySignature(planInput("Workout", null, [e, other]))).not.toBe(
    workoutCopySignature(planInput("Workout", null, [other, e])),
  );
});
