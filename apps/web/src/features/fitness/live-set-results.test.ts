import { describe, expect, it } from "vitest";
import { emptySet } from "./strength-draft";
import { canCompleteLiveSet, liveSetResults } from "./live-set-results";

describe("live workout result confirmation", () => {
  it("offers targets without mutating or completing the stored set", () => {
    const set = { ...emptySet(), targetReps: 12, targetWeightKg: 0 };
    const result = liveSetResults(set, "reps_load");
    expect(result).toMatchObject({ reps: 12, weightKg: 0, completed: false });
    expect(set).toMatchObject({ reps: null, weightKg: null, completed: false });
    expect(canCompleteLiveSet(result)).toBe(true);
  });
  it("does not fill unknown results after any actual value has been recorded", () => {
    const set = { ...emptySet(), reps: 7, targetReps: 12, targetWeightKg: 20 };
    expect(liveSetResults(set, "reps_load")).toBe(set);
    expect(liveSetResults(set, "reps_load").weightKg).toBeNull();
    expect(
      liveSetResults({ ...set, reps: null, weightKg: 0 }, "reps_load").reps,
    ).toBeNull();
  });
  it("offers planned values again when revisiting untouched skipped sets", () => {
    const set = { ...emptySet(), targetReps: 12, skipped: true };
    const result = liveSetResults(set, "reps");
    expect(result).toMatchObject({ reps: 12, skipped: true, completed: false });
    expect(canCompleteLiveSet(result)).toBe(true);
    expect(set.reps).toBeNull();
    const partial = { ...set, weightKg: 0 };
    expect(liveSetResults(partial, "reps_load")).toBe(partial);
  });
  it("never fills completed sets from targets", () => {
    const set = { ...emptySet(), targetReps: 12 };
    const completed = { ...set, skipped: false, completed: true };
    expect(liveSetResults(completed, "reps")).toBe(completed);
    expect(canCompleteLiveSet(completed)).toBe(false);
  });
  it("uses the set's measurements and preserves hidden targets", () => {
    const set = {
      ...emptySet(),
      measurementOverride: "duration" as const,
      targetDurationSeconds: 30,
      targetWeightKg: 99,
    };
    expect(liveSetResults(set, "reps_load")).toMatchObject({
      durationSeconds: 30,
      weightKg: null,
      targetWeightKg: 99,
    });
  });
  it("requires a valid result when targets are absent or invalid", () => {
    expect(canCompleteLiveSet(liveSetResults(emptySet(), "reps_load"))).toBe(
      false,
    );
    expect(canCompleteLiveSet({ ...emptySet(), reps: 0 })).toBe(false);
  });
});

it("keeps deliberately cleared results unknown after serialization", () => {
  const set = {
    ...emptySet(),
    targetReps: 12,
    targetWeightKg: 40,
    resultsEdited: true,
  };
  const restored = JSON.parse(JSON.stringify(set));
  expect(liveSetResults(restored, "reps_load")).toMatchObject({
    reps: null,
    weightKg: null,
  });
  expect(canCompleteLiveSet(liveSetResults(restored, "reps_load"))).toBe(false);
});
