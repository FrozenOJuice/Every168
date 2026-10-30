import { workoutSeconds } from "@168hours/domain-utils";
import { measurementsFor } from "@168hours/contracts";
import { addDays, localDate, weekRange } from "@168hours/domain-utils";
import type {
  ExerciseReportQuery,
  ProgressExerciseQuery,
  StrengthMetrics,
  WeightRecordsQuery,
} from "@168hours/contracts";
import type { IdentityService } from "../identity/identity.service.js";
import type { ExerciseService } from "./exercise.service.js";
import type { StrengthService } from "./strength.service.js";
import type { strengthProgressRepository } from "./strength-progress.repository.js";

type SavedWorkout = Awaited<ReturnType<StrengthService["get"]>>;
function summarize(workout: SavedWorkout) {
  return {
    id: workout.id,
    title: workout.title,
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    durationSeconds: workout.endedAt
      ? workoutSeconds({
          startedAt: workout.startedAt.toISOString(),
          endedAt: workout.endedAt.toISOString(),
          pauses: workout.pauses,
        })
      : null,
    exercises: workout.exercises.map((e) => {
      const selected = (s: (typeof e.sets)[number]) =>
        measurementsFor(s.measurementOverride ?? e.loggingType);
      const weighted = (s: (typeof e.sets)[number]) =>
        selected(s).includes("reps") && selected(s).includes("load");
      const sets = e.sets.filter((s) => s.completed && !s.skipped);
      const maximum = (
        key:
          "reps" | "weightKg" | "durationSeconds" | "distanceMeters" | "laps",
      ) => {
        const field = {
          reps: "reps",
          weightKg: "load",
          durationSeconds: "duration",
          distanceMeters: "distance",
          laps: "laps",
        } as const;
        const values = sets.flatMap((s) =>
          s[key] === null || !selected(s).includes(field[key]) ? [] : [s[key]!],
        );
        return values.length ? Math.max(...values) : null;
      };
      const weightedSets = sets.filter(weighted);
      const volume = weightedSets.filter(
        (s) => s.reps !== null && s.weightKg !== null,
      );
      const metrics: StrengthMetrics = {
        completedSets: sets.length,
        maxReps: maximum("reps"),
        maxWeightKg: maximum("weightKg"),
        maxDurationSeconds: maximum("durationSeconds"),
        maxDistanceMeters: maximum("distanceMeters"),
        maxLaps: maximum("laps"),
        volumeKg: volume.length
          ? volume.reduce((total, s) => total + s.reps! * s.weightKg!, 0)
          : null,
        missingVolumeSets: weightedSets.length - volume.length,
      };
      return {
        exerciseId: e.exerciseId,
        name: e.exerciseNameSnapshot,
        loggingType: e.loggingType,
        measurementTypes: [
          ...new Set(e.sets.map((s) => s.measurementOverride ?? e.loggingType)),
        ],
        ...metrics,
      };
    }),
  };
}
export function strengthProgressService(
  repo: ReturnType<typeof strengthProgressRepository>,
  identity: IdentityService,
  exercises: ExerciseService,
  strength: StrengthService,
) {
  return {
    async overview(u: string, date?: string) {
      const { timezone, weekStartsOn } = await identity.getPreferences(u);
      const current = weekRange(
        date ?? localDate(new Date(), timezone),
        timezone,
        weekStartsOn,
      );
      const ranges = Array.from({ length: 12 }, (_, i) =>
        weekRange(
          addDays(current.weekStart, (i - 11) * 7),
          timezone,
          weekStartsOn,
        ),
      );
      return {
        timezone,
        weekStart: current.weekStart,
        weeks: await repo.overview(u, ranges),
      };
    },
    exercises: (u: string, q: ProgressExerciseQuery) => repo.exercises(u, q),
    async exercise(u: string, id: string, q: ExerciseReportQuery) {
      const exercise = await exercises.get(u, id);
      if (q.excludeWorkoutId) await strength.get(u, q.excludeWorkoutId);
      const loggingType = q.loggingType ?? exercise.loggingType;
      return {
        exercise,
        loggingType,
        ...(await repo.exercise(u, id, loggingType, q)),
      };
    },
    async weightRecords(u: string, id: string, q: WeightRecordsQuery) {
      await exercises.get(u, id);
      return repo.weightRecords(u, id, q);
    },
    async workoutRecords(u: string, id: string) {
      const workout = await strength.get(u, id);
      return workout.endedAt
        ? repo.workoutRecords(u, id, workout.startedAt)
        : { records: [] };
    },
    async comparison(u: string, id: string) {
      const current = await strength.get(u, id);
      const previousId = await repo.previousMatching(u, id, current.startedAt);
      const previous = previousId ? await strength.get(u, previousId) : null;
      // Repeated occurrences with identical selections match in occurrence order.
      const signature = (e: SavedWorkout["exercises"][number]) =>
        e.exerciseId +
        ":" +
        e.loggingType +
        (e.sets.some((s) => s.measurementOverride !== null)
          ? ":" +
            e.sets.map((s) => s.measurementOverride ?? e.loggingType).join(";")
          : "");
      if (previous) {
        const remaining = [...previous.exercises];
        previous.exercises = current.exercises.map((e) => {
          const index = remaining.findIndex(
            (candidate) => signature(candidate) === signature(e),
          );
          return remaining.splice(index, 1)[0]!;
        });
      }
      return {
        current: summarize(current),
        previous: previous ? summarize(previous) : null,
      };
    },
  };
}
export type StrengthProgressService = ReturnType<
  typeof strengthProgressService
>;
