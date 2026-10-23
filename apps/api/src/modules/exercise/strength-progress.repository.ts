import {
  and,
  eq,
  isNotNull,
  ne,
  lt,
  gte,
  desc,
  asc,
  sql,
  ilike,
} from "drizzle-orm";
import type {
  ExerciseLoggingType,
  ExerciseReportQuery,
  ProgressExerciseQuery,
} from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import {
  exercises,
  strengthWorkouts as workouts,
  workoutExercises as entries,
  strengthSets as sets,
} from "./exercise.table.js";

// Every join is explicitly owner-scoped. Only actual completed sets in finished workouts qualify.
const scope = (u: string) =>
  and(
    eq(sets.userId, u),
    eq(entries.userId, u),
    eq(workouts.userId, u),
    eq(sets.completed, true),
    eq(sets.skipped, false),
    isNotNull(workouts.endedAt),
  );
const weightedReps = sql`${entries.loggingType} = 'reps_load'`;
const volume = sql<
  number | null
>`sum(case when ${weightedReps} then ${sets.reps} * ${sets.weightKg} end)`.mapWith(
  Number,
);
const missingVolume =
  sql<number>`count(*) filter (where ${weightedReps} and (${sets.reps} is null or ${sets.weightKg} is null))`.mapWith(
    Number,
  );
const metrics = {
  completedSets: sql<number>`count(*)`.mapWith(Number),
  maxReps: sql<
    number | null
  >`max(case when ${entries.loggingType} in ('reps','reps_load') then ${sets.reps} end)`.mapWith(
    Number,
  ),
  maxWeightKg: sql<
    number | null
  >`max(case when ${entries.loggingType} in ('reps_load','duration_load') then ${sets.weightKg} end)`.mapWith(
    Number,
  ),
  maxDurationSeconds: sql<
    number | null
  >`max(case when ${entries.loggingType} in ('duration','duration_load','distance_duration','laps_duration') then ${sets.durationSeconds} end)`.mapWith(
    Number,
  ),
  maxDistanceMeters: sql<number | null>`max(${sets.distanceMeters})`.mapWith(
    Number,
  ),
  maxLaps: sql<number | null>`max(${sets.laps})`.mapWith(Number),
  volumeKg: volume,
  missingVolumeSets: missingVolume,
};
export function strengthProgressRepository(db: Database) {
  return {
    async overview(
      u: string,
      ranges: { weekStart: string; startsAt: string; endsAt: string }[],
    ) {
      return db.transaction(
        async (tx) => {
          const result = [];
          for (const range of ranges) {
            const within = and(
              gte(workouts.startedAt, new Date(range.startsAt)),
              lt(workouts.startedAt, new Date(range.endsAt)),
            );
            const [sessions] = await tx
              .select({
                workoutCount: sql<number>`count(*)`.mapWith(Number),
                durationSeconds:
                  sql<number>`coalesce(sum(extract(epoch from (${workouts.endedAt} - ${workouts.startedAt}))),0)`.mapWith(
                    Number,
                  ),
              })
              .from(workouts)
              .where(
                and(
                  eq(workouts.userId, u),
                  isNotNull(workouts.endedAt),
                  within,
                ),
              );
            const [totals] = await tx
              .select({
                completedSets: metrics.completedSets,
                volumeKg: volume,
                missingVolumeSets: missingVolume,
              })
              .from(sets)
              .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
              .innerJoin(workouts, eq(entries.workoutId, workouts.id))
              .where(and(scope(u), within));
            result.push({
              weekStart: range.weekStart,
              ...sessions!,
              ...totals!,
            });
          }
          return result;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async exercises(u: string, q: ProgressExerciseQuery) {
      const rows = await db
        .select({
          id: exercises.id,
          createdAt: exercises.createdAt,
          name: exercises.name,
          archived: sql<boolean>`${exercises.archivedAt} is not null`,
        })
        .from(exercises)
        .where(
          and(
            eq(exercises.userId, u),
            q.search
              ? ilike(
                  exercises.name,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            cursorCondition(q, exercises.createdAt, exercises.id),
            sql`exists (select 1 from ${entries} join ${workouts} on ${workouts.id} = ${entries.workoutId} join ${sets} on ${sets.workoutExerciseId} = ${entries.id} where ${entries.exerciseId} = ${exercises.id} and ${scope(u)})`,
          ),
        )
        .orderBy(desc(exercises.createdAt), desc(exercises.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async exercise(
      u: string,
      id: string,
      mode: ExerciseLoggingType,
      q: ExerciseReportQuery,
    ) {
      return db.transaction(
        async (tx) => {
          const filter = and(
            scope(u),
            eq(entries.exerciseId, id),
            eq(entries.loggingType, mode),
            q.excludeWorkoutId
              ? ne(workouts.id, q.excludeWorkoutId)
              : undefined,
            q.before ? lt(workouts.startedAt, new Date(q.before)) : undefined,
          );
          const rows = await tx
            .select({
              id: workouts.id,
              createdAt: workouts.startedAt,
              title: workouts.title,
              startedAt: workouts.startedAt,
              endedAt: workouts.endedAt,
              ...metrics,
            })
            .from(sets)
            .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
            .innerJoin(workouts, eq(entries.workoutId, workouts.id))
            .where(
              and(filter, cursorCondition(q, workouts.startedAt, workouts.id)),
            )
            .groupBy(workouts.id)
            .orderBy(desc(workouts.startedAt), desc(workouts.id))
            .limit(q.limit + 1);
          const measures =
            mode === "reps_load"
              ? (["load", "reps", "setVolume"] as const)
              : mode === "duration_load"
                ? (["load", "duration"] as const)
                : mode === "reps"
                  ? (["reps"] as const)
                  : mode === "distance_duration"
                    ? (["distance", "duration"] as const)
                    : mode === "laps_duration"
                      ? (["laps", "duration"] as const)
                      : (["duration"] as const);
          const records = [];
          for (const metric of measures) {
            const value =
              metric === "load"
                ? sets.weightKg
                : metric === "reps"
                  ? sets.reps
                  : metric === "duration"
                    ? sets.durationSeconds
                    : metric === "distance"
                      ? sets.distanceMeters
                      : metric === "laps"
                        ? sets.laps
                        : sql<number>`${sets.reps} * ${sets.weightKg}`.mapWith(
                            Number,
                          );
            const [record] = await tx
              .select({
                value,
                workoutId: workouts.id,
                workoutTitle: workouts.title,
                startedAt: workouts.startedAt,
                setId: sets.id,
                reps: sets.reps,
                weightKg: sets.weightKg,
                durationSeconds: sets.durationSeconds,
                distanceMeters: sets.distanceMeters,
                laps: sets.laps,
              })
              .from(sets)
              .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
              .innerJoin(workouts, eq(entries.workoutId, workouts.id))
              .where(and(filter, isNotNull(value)))
              .orderBy(
                desc(value),
                asc(workouts.startedAt),
                asc(workouts.id),
                asc(entries.position),
                asc(sets.position),
              )
              .limit(1);
            if (record) records.push({ metric, ...record });
          }
          return { records, sessions: pageResult(rows, q.limit) };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async previousMatching(u: string, id: string, startedAt: Date) {
      // Match the ordered exercise identities and captured tracking modes, never titles.
      const signature = (workout: typeof workouts.id | string) =>
        sql`(select string_agg(${entries.exerciseId}::text || ':' || ${entries.loggingType}, ',' order by ${entries.position}) from ${entries} where ${entries.workoutId} = ${workout} and ${entries.userId} = ${u})`;
      const [previous] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, u),
            ne(workouts.id, id),
            isNotNull(workouts.endedAt),
            lt(workouts.startedAt, startedAt),
            sql`${signature(workouts.id)} = ${signature(id)}`,
          ),
        )
        .orderBy(desc(workouts.startedAt), desc(workouts.id))
        .limit(1);
      return previous?.id;
    },
  };
}
