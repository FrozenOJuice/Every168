import type { ProgressSession, WorkoutRecords } from "@168hours/contracts";
import { expect, it } from "vitest";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import {
  actualExerciseSummary,
  progressSessionSummary,
  summaryExerciseOutcome,
  summaryRecordHighlights,
} from "./workout-review-summary";
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

it("groups confirmed report results without counting skipped or unfinished sets or hidden measurements", () => {
  const completed = {
    id: "set",
    reps: 12,
    weightKg: 50,
    durationSeconds: null,
    distanceMeters: null,
    laps: null,
    completed: true,
    skipped: false,
    loggingType: "reps_load" as const,
  };
  const session: ProgressSession = {
    id: "session",
    title: "Training",
    startedAt: "2026-10-28T10:00:00Z",
    endedAt: "2026-10-28T11:00:00Z",
    completedSets: 3,
    maxReps: 12,
    maxWeightKg: 50,
    maxDurationSeconds: null,
    maxDistanceMeters: null,
    maxLaps: null,
    volumeKg: 1800,
    missingVolumeSets: 0,
    sets: [
      completed,
      { ...completed, id: "second" },
      { ...completed, id: "third" },
      {
        ...completed,
        id: "skipped",
        completed: false,
        skipped: true,
        reps: 999,
        weightKg: 999,
      },
      { ...completed, id: "unfinished", completed: false, reps: 999 },
    ],
  };
  expect(
    progressSessionSummary(
      { id: "bench", name: "Bench", loggingType: "duration" },
      session,
      units,
    ),
  ).toBe("3×12 | 50 kg");
  expect(
    progressSessionSummary(
      { id: "bench", name: "Bench", loggingType: "reps_load" },
      {
        ...session,
        sets: [
          {
            ...completed,
            loggingType: "duration",
            durationSeconds: 90,
            reps: 999,
            weightKg: 999,
          },
        ],
      },
      units,
    ),
  ).toBe("1×1m 30s");
});

it("names non-performed exercise outcomes without treating them as missing recorded results", () => {
  const skipped = { ...emptySet(), skipped: true, completed: false };
  const unfinished = { ...emptySet(), completed: false };
  expect(summaryExerciseOutcome({ sets: [skipped, skipped] })).toBe("Skipped");
  expect(summaryExerciseOutcome({ sets: [unfinished] })).toBe("Unfinished");
  expect(
    summaryExerciseOutcome({ sets: [skipped, unfinished, unfinished] }),
  ).toBe("1 skipped · 2 unfinished");
  expect(summaryExerciseOutcome({ sets: [] })).toBe("No sets recorded");
  expect(
    summaryExerciseOutcome({
      sets: [{ ...emptySet(), completed: true, reps: 1 }, skipped],
    }),
  ).toBeNull();
});

it("surfaces new records for completed sets in their own occurrence and keeps baseline/distance/duration labels neutral", () => {
  const current = {
    ...exercise,
    id: "occurrence-a",
    sets: [
      {
        ...emptySet(),
        id: "completed",
        completed: true,
        reps: 12,
        weightKg: 50,
      },
      { ...emptySet(), id: "unfinished", completed: false },
      { ...emptySet(), id: "skipped", completed: false, skipped: true },
    ],
  };
  const record = (
    patch: Partial<WorkoutRecords["records"][number]> = {},
  ): WorkoutRecords["records"][number] => ({
    exerciseId: exercise.exerciseId,
    workoutExerciseId: "occurrence-a",
    setId: "completed",
    metric: "load",
    value: 50,
    weightKg: 50,
    reps: 12,
    first: false,
    ...patch,
  });
  expect(
    summaryRecordHighlights(current, [
      record({ first: true }),
      record({ first: true, metric: "reps" }),
    ]),
  ).toEqual([
    { label: "First recorded result", performance: false, first: true },
  ]);
  expect(
    summaryRecordHighlights(current, [
      record(),
      record({ metric: "repsAtWeight" }),
      record({ metric: "repsAtWeight" }),
      record({ metric: "reps", first: true }),
      record({ metric: "distance" }),
      record({ metric: "duration" }),
      record({ setId: "unfinished", metric: "reps" }),
      record({ setId: "skipped", metric: "reps" }),
      record({ workoutExerciseId: "occurrence-b", metric: "reps" }),
    ]),
  ).toEqual([
    { label: "2 new records", performance: true, first: false },
    { label: "Longest recorded distance", performance: false, first: false },
    { label: "Longest recorded duration", performance: false, first: false },
  ]);
  expect(
    summaryRecordHighlights(current, [
      record({ setId: "other-occurrence-set" }),
    ]),
  ).toEqual([]);
});
