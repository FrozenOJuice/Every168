import { addDays, localDate, weekRange } from "@168hours/domain-utils";
import type {
  ExerciseReportQuery,
  ProgressExerciseQuery,
  StrengthMetrics,
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
      ? (workout.endedAt.getTime() - workout.startedAt.getTime()) / 1000
      : null,
    exercises: workout.exercises.map((e) => {
      const sets = e.sets.filter((s) => s.completed && !s.skipped);
      const maximum = (
        key:
          "reps" | "weightKg" | "durationSeconds" | "distanceMeters" | "laps",
      ) => {
        const values = sets.flatMap((s) => (s[key] === null ? [] : [s[key]!]));
        return values.length ? Math.max(...values) : null;
      };
      const volume =
        e.loggingType === "reps_load"
          ? sets.filter((s) => s.reps !== null && s.weightKg !== null)
          : [];
      const metrics: StrengthMetrics = {
        completedSets: sets.length,
        maxReps:
          e.loggingType === "reps" || e.loggingType === "reps_load"
            ? maximum("reps")
            : null,
        maxWeightKg:
          e.loggingType === "reps_load" || e.loggingType === "duration_load"
            ? maximum("weightKg")
            : null,
        maxDurationSeconds: [
          "duration",
          "duration_load",
          "distance_duration",
          "laps_duration",
        ].includes(e.loggingType)
          ? maximum("durationSeconds")
          : null,
        maxDistanceMeters: maximum("distanceMeters"),
        maxLaps: maximum("laps"),
        volumeKg: volume.length
          ? volume.reduce((total, s) => total + s.reps! * s.weightKg!, 0)
          : null,
        missingVolumeSets:
          e.loggingType === "reps_load" ? sets.length - volume.length : 0,
      };
      return {
        exerciseId: e.exerciseId,
        name: e.exerciseNameSnapshot,
        loggingType: e.loggingType,
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
    async comparison(u: string, id: string) {
      const current = await strength.get(u, id);
      const previousId = await repo.previousMatching(u, id, current.startedAt);
      return {
        current: summarize(current),
        previous: previousId
          ? summarize(await strength.get(u, previousId))
          : null,
      };
    },
  };
}
export type StrengthProgressService = ReturnType<
  typeof strengthProgressService
>;
