import { expect, it } from "vitest";
import { emptySet, type ExerciseDraft, type SetDraft } from "./strength-draft";
import { workoutExerciseSummary } from "./workout-exercise-summary";

const metric = { weightUnit: "kg", distanceUnit: "km" } as const;
const exercise = (
  sets: Partial<SetDraft>[],
  loggingType: ExerciseDraft["loggingType"] = "reps_load",
): ExerciseDraft => ({
  exerciseId: "bench",
  name: "Bench press",
  notes: null,
  loggingType,
  sets: sets.map((set) => ({ ...emptySet(), ...set })),
});

it("summarizes matching planned sets without counting rest or recorded results", () => {
  const draft = exercise(
    Array.from({ length: 3 }, () => ({
      targetReps: 12,
      targetWeightKg: 100,
      reps: 8,
      weightKg: 80,
    })),
  );
  draft.sets[0]!.restSeconds = 90;
  expect(workoutExerciseSummary(draft, metric)).toBe("3×12 | 100 kg");
});

it("shows ranges and identifies partially unset targets rather than implying matching sets", () => {
  expect(
    workoutExerciseSummary(
      exercise([
        { targetReps: 12, targetWeightKg: 80 },
        { targetReps: 8, targetWeightKg: 100 },
      ]),
      metric,
    ),
  ).toBe("2 sets | 8–12 reps | 80–100 kg");
  expect(
    workoutExerciseSummary(
      exercise([
        { targetReps: 12, targetWeightKg: 100 },
        { targetWeightKg: 100 },
      ]),
      metric,
    ),
  ).toBe("2 sets | 12 reps | 100 kg | Some targets unset");
});

it("respects per-set measurements and excludes saved targets for hidden measurements", () => {
  expect(
    workoutExerciseSummary(
      exercise([
        { targetReps: 12, targetWeightKg: 100 },
        { measurementOverride: "duration", targetDurationSeconds: 60 },
      ]),
      metric,
    ),
  ).toBe("1×12 | 100 kg / 1×1m");
  expect(
    workoutExerciseSummary(
      exercise(
        [{ targetReps: 12, targetWeightKg: 100, targetDurationSeconds: 90 }],
        "duration",
      ),
      metric,
    ),
  ).toBe("1×1m 30s");
});

it("groups consecutive matching mixed sets and preserves their order", () => {
  const draft = exercise([
    { measurementOverride: "duration", targetDurationSeconds: 45 },
    { targetReps: 8, targetWeightKg: 80, targetDurationSeconds: 999 },
    { targetReps: 8, targetWeightKg: 80, restSeconds: 90 },
    { measurementOverride: "duration", targetDurationSeconds: 45 },
  ]);
  expect(workoutExerciseSummary(draft, metric)).toBe(
    "1×45s / 2×8 | 80 kg / 1×45s",
  );
  draft.sets.push(...exercise([{ targetReps: 10 }, { targetReps: 12 }]).sets);
  expect(workoutExerciseSummary(draft, metric)).toBe(
    "1×45s / 2×8 | 80 kg / 1×45s / + 2 sets",
  );
});

it("identifies mixed sets with no targets and retains preferred units and zero load", () => {
  expect(
    workoutExerciseSummary(
      exercise([
        { measurementOverride: "duration" },
        {
          measurementOverride: "distance_load",
          targetDistanceMeters: 1609.344,
          targetWeightKg: 0,
        },
      ]),
      { weightUnit: "lb", distanceUnit: "mi" },
    ),
  ).toBe("1 set | duration / 1×1 mi | 0 lb");
});

it("uses preferred units and includes each selected measurement", () => {
  expect(
    workoutExerciseSummary(
      exercise(
        [{ targetDistanceMeters: 1609.344, targetWeightKg: 45.359237 }],
        "distance_load",
      ),
      { weightUnit: "lb", distanceUnit: "mi" },
    ),
  ).toBe("1×1 mi | 100 lb");
  expect(
    workoutExerciseSummary(
      exercise(
        [
          {
            targetReps: 12,
            targetWeightKg: 100,
            targetDurationSeconds: 90,
            targetDistanceMeters: 1000,
            targetLaps: 2,
          },
        ],
        "reps_distance_laps_duration_load",
      ),
      metric,
    ),
  ).toBe("1×12 | 1m 30s | 1 km | 2 laps | 100 kg");
});

it("keeps empty targets distinct from an explicit zero load", () => {
  expect(workoutExerciseSummary(exercise([{}, {}]), metric)).toBe("2 sets");
  expect(
    workoutExerciseSummary(exercise([{ targetWeightKg: 0 }]), metric),
  ).toBe("1 set | 0 kg");
  expect(workoutExerciseSummary(exercise([]), metric)).toBe("0 sets");
});

it("keeps phone summaries short while ignoring hidden values and actual results", () => {
  const draft = exercise([
    { targetReps: 8, targetWeightKg: 20, targetDurationSeconds: 90 },
    { targetReps: 8, targetWeightKg: 20, reps: 6 },
  ]);
  expect(workoutExerciseSummary(draft, metric, true)).toBe("2×8 | 20 kg");
  draft.sets[1]!.targetReps = null;
  expect(workoutExerciseSummary(draft, metric, true)).toBe(
    "2 sets · Mixed targets",
  );
  draft.sets[1]!.measurementOverride = "duration";
  expect(workoutExerciseSummary(draft, metric, true)).toBe(
    "2 sets · Mixed targets",
  );
  expect(
    workoutExerciseSummary(
      exercise([{}], "reps_distance_laps_duration_load"),
      metric,
      true,
    ),
  ).toBe("1 set · 5 measurements");
});

it("uses selected units per set and rounds load like its input", () => {
  const draft = exercise([
    { targetReps: 12, targetWeightKg: 20 },
    { targetReps: 12, targetWeightKg: 20 },
  ]);
  const pounds = { ...metric, weightUnit: "lb" as const };
  expect(workoutExerciseSummary(draft, metric, false, [pounds, pounds])).toBe(
    "2×12 | 44.09 lb",
  );
  expect(workoutExerciseSummary(draft, metric, false, [pounds, metric])).toBe(
    "1×12 | 44.09 lb / 1×12 | 20 kg",
  );
  expect(workoutExerciseSummary(draft, metric, true, [pounds, metric])).toBe(
    "2 sets · Mixed units",
  );
});
