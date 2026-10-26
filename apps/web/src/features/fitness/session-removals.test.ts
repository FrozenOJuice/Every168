import { expect, it } from "vitest";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import {
  removedResults,
  applyRemoval,
  restoreRemoval,
} from "./session-removals";
const exercise = (): ExerciseDraft => ({
  id: "old-exercise",
  clientKey: "exercise",
  exerciseId: "definition",
  name: "Bench",
  notes: null,
  sets: [
    {
      ...emptySet(),
      id: "first-id",
      clientKey: "first",
      completed: true,
      reps: 12,
    },
    {
      ...emptySet(),
      id: "second-id",
      clientKey: "second",
      resultsEdited: true,
    },
    { ...emptySet(), id: "third-id", clientKey: "third", skipped: true },
  ],
});
it("protects completed, skipped and cleared results but not untouched targets", () => {
  const old = exercise();
  expect(removedResults([old], [{ ...old, sets: old.sets.slice(0, 1) }])).toBe(
    2,
  );
  expect(
    removedResults([{ ...old, sets: [{ ...emptySet(), targetReps: 12 }] }], []),
  ).toBe(0);
});
it("removes reviewed occurrences and restores new identities without replacing later edits", () => {
  const old = exercise();
  const next = { ...old, sets: old.sets.slice(0, 1) };
  const current = [
    {
      ...old,
      notes: "Changed while saving",
      sets: old.sets.map((s) => ({ ...s, targetReps: 8 })),
    },
  ];
  const removed = applyRemoval(current, [old], [next]);
  expect(removed[0]!.sets).toHaveLength(1);
  const restored = restoreRemoval(removed, [old], [next])!;
  expect(restored[0]!.notes).toBe("Changed while saving");
  expect(restored[0]!.sets[0]).toMatchObject({ id: "first-id", targetReps: 8 });
  expect(restored[0]!.sets[1]).toMatchObject({
    id: undefined,
    clientKey: "second",
    resultsEdited: true,
  });
  const whole = restoreRemoval([], [old], [])!;
  expect(whole[0]!.id).toBeUndefined();
  expect(whole[0]!.sets.every((s) => s.id === undefined)).toBe(true);
});
