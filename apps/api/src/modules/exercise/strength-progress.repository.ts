import { measurementsFor, type ExerciseMeasurement } from "@168hours/contracts";
import {
  and,
  inArray,
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
const effectiveType = sql<ExerciseLoggingType>`coalesce(${sets.measurementOverride}, ${entries.loggingType})`;
const hasMeasurement = (field: ExerciseMeasurement) =>
  sql`${field} = any(string_to_array(${effectiveType}, '_'))`;
const weightedReps = sql`${hasMeasurement("reps")} and ${hasMeasurement("load")}`;
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
  >`max(case when ${hasMeasurement("reps")} then ${sets.reps} end)`.mapWith(
    Number,
  ),
  maxWeightKg: sql<
    number | null
  >`max(case when ${hasMeasurement("load")} then ${sets.weightKg} end)`.mapWith(
    Number,
  ),
  maxDurationSeconds: sql<
    number | null
  >`max(case when ${hasMeasurement("duration")} then ${sets.durationSeconds} end)`.mapWith(
    Number,
  ),
  maxDistanceMeters: sql<
    number | null
  >`max(case when ${hasMeasurement("distance")} then ${sets.distanceMeters} end)`.mapWith(
    Number,
  ),
  maxLaps: sql<
    number | null
  >`max(case when ${hasMeasurement("laps")} then ${sets.laps} end)`.mapWith(
    Number,
  ),
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
      const page = pageResult(rows, q.limit);
      if (!page.items.length) return { ...page, items: [] };
      const latest = await db
        .selectDistinctOn([entries.exerciseId], {
          exerciseId: entries.exerciseId,
          workoutId: workouts.id,
          startedAt: workouts.startedAt,
          loggingType: effectiveType,
        })
        .from(sets)
        .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
        .innerJoin(workouts, eq(entries.workoutId, workouts.id))
        .where(
          and(
            scope(u),
            inArray(
              entries.exerciseId,
              page.items.map((row) => row.id),
            ),
          ),
        )
        .orderBy(
          asc(entries.exerciseId),
          desc(workouts.startedAt),
          desc(workouts.id),
          asc(entries.position),
          asc(sets.position),
        );
      const latestSets = latest.length
        ? await db
            .select({
              exerciseId: entries.exerciseId,
              workoutId: workouts.id,
              loggingType: effectiveType,
              position: sets.position,
              id: sets.id,
              reps: sets.reps,
              weightKg: sets.weightKg,
              durationSeconds: sets.durationSeconds,
              distanceMeters: sets.distanceMeters,
              laps: sets.laps,
            })
            .from(sets)
            .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
            .innerJoin(workouts, eq(entries.workoutId, workouts.id))
            .where(
              and(
                scope(u),
                inArray(
                  entries.exerciseId,
                  page.items.map((row) => row.id),
                ),
                inArray(
                  workouts.id,
                  latest.map((row) => row.workoutId),
                ),
              ),
            )
            .orderBy(asc(entries.position), asc(sets.position))
        : [];
      return {
        ...page,
        items: page.items.map((row) => {
          const last = latest.find((item) => item.exerciseId === row.id);
          return {
            ...row,
            latest: last
              ? {
                  startedAt: last.startedAt,
                  loggingType: last.loggingType,
                  sets: latestSets.filter(
                    (set) =>
                      set.exerciseId === row.id &&
                      set.workoutId === last.workoutId &&
                      set.loggingType === last.loggingType,
                  ),
                }
              : null,
          };
        }),
      };
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
            sql`${effectiveType} = ${mode}`,
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
          const fields = measurementsFor(mode);
          const measures: (ExerciseMeasurement | "setVolume")[] = [...fields];
          if (fields.includes("reps") && fields.includes("load"))
            measures.push("setVolume");
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
          const page = pageResult(rows, q.limit);
          const recordedSets = page.items.length
            ? await tx
                .select({
                  workoutId: workouts.id,
                  position: sets.position,
                  id: sets.id,
                  reps: sets.reps,
                  weightKg: sets.weightKg,
                  durationSeconds: sets.durationSeconds,
                  distanceMeters: sets.distanceMeters,
                  laps: sets.laps,
                })
                .from(sets)
                .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
                .innerJoin(workouts, eq(entries.workoutId, workouts.id))
                .where(
                  and(
                    filter,
                    inArray(
                      workouts.id,
                      page.items.map((row) => row.id),
                    ),
                  ),
                )
                .orderBy(asc(entries.position), asc(sets.position))
            : [];
          return {
            records,
            sessions: {
              ...page,
              items: page.items.map((row) => ({
                ...row,
                sets: recordedSets.filter((set) => set.workoutId === row.id),
              })),
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async previousMatching(u: string, id: string, startedAt: Date) {
      // Match the ordered exercise identities and captured tracking modes, never titles.
      const signature = (workout: typeof workouts.id | string) =>
        sql`(select string_agg(${entries.exerciseId}::text || ':' || ${entries.loggingType} || coalesce((select ':' || string_agg(coalesce(${sets.measurementOverride}, ${entries.loggingType}), ';' order by ${sets.position}) from ${sets} where ${sets.workoutExerciseId} = ${entries.id} and ${sets.userId} = ${u} having bool_or(${sets.measurementOverride} is not null)), ''), ',' order by ${entries.position}) from ${entries} where ${entries.workoutId} = ${workout} and ${entries.userId} = ${u})`;
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
