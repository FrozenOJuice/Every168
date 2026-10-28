import { expect, it } from "vitest";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import { actualExerciseSummary } from "./workout-review-summary";
import { formatRestDuration } from "./rest-duration";
const units = { weightUnit: "kg", distanceUnit: "km" } as const;
const exercise: ExerciseDraft = {
  exerciseId: "bench",
  name: "Bench",
  notes: null,
  loggingType: "reps_load",
  sets: [],
};
it("reviews actual results without borrowing targets or counting skipped and unfinished sets", () => {
  const sets = [
    {
      ...emptySet(),
      completed: true,
      reps: 8,
      weightKg: 0,
      targetReps: 12,
      targetWeightKg: 40,
    },
    { ...emptySet(), completed: false, skipped: true, reps: 20, weightKg: 100 },
    { ...emptySet(), completed: false, reps: 20, weightKg: 100 },
  ];
  expect(actualExerciseSummary({ ...exercise, sets }, units)).toBe(
    "1×8 | 0 kg",
  );
});
it("identifies unknown results and respects set-specific measurements", () => {
  expect(
    actualExerciseSummary(
      {
        ...exercise,
        sets: [
          {
            ...emptySet(),
            completed: true,
            targetReps: 12,
            targetWeightKg: 40,
          },
        ],
      },
      units,
    ),
  ).toBe("1 set | Some results not recorded");
  expect(
    actualExerciseSummary(
      {
        ...exercise,
        sets: [
          {
            ...emptySet(),
            completed: true,
            measurementOverride: "duration",
            durationSeconds: 90,
            weightKg: 40,
          },
        ],
      },
      units,
    ),
  ).toBe("1×1m 30s");
  expect(actualExerciseSummary(exercise, units)).toBe("No completed sets");
});
it("formats duration boundaries without raw long second values", () => {
  expect([0, 59, 60, 90, 3600, 3661].map(formatRestDuration)).toEqual([
    "0s",
    "59s",
    "1m",
    "1m 30s",
    "1h",
    "1h 1m 1s",
  ]);
});

it("keeps recorded summary units aligned with completed sets after skipped rows are filtered", () => {
  const first = {
    ...emptySet(),
    completed: false,
    skipped: true,
    weightKg: 100,
  };
  const second = { ...emptySet(), completed: true, reps: 8, weightKg: 20 };
  const result = actualExerciseSummary(
    { ...exercise, sets: [first, second] },
    units,
    [units, { ...units, weightUnit: "lb" }],
  );
  expect(result).toContain("44.09 lb");
  expect(result).not.toContain("kg");
  const mixed = actualExerciseSummary(
    { ...exercise, sets: [second, second] },
    units,
    [units, { ...units, weightUnit: "lb" }],
  );
  expect(mixed).toContain("20 kg");
  expect(mixed).toContain("44.09 lb");
});
