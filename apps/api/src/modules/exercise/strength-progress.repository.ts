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
  WeightRecordsQuery,
  WorkoutRecords,
} from "@168hours/contracts";
import { alias } from "drizzle-orm/pg-core";
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
  sql`${sets.completed} and not ${sets.skipped} and ${field} = any(string_to_array(${effectiveType}, '_'))`;
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
                  sql<number>`coalesce(sum(extract(epoch from (${workouts.endedAt} - ${workouts.startedAt})) -
                    coalesce((select sum(extract(epoch from ((p->>'endsAt')::timestamptz - (p->>'startsAt')::timestamptz))) from jsonb_array_elements(${workouts.pauses}) p), 0)),0)`.mapWith(
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
          const baseFilter = and(
            eq(sets.userId, u),
            eq(entries.userId, u),
            eq(workouts.userId, u),
            isNotNull(workouts.endedAt),
            eq(entries.exerciseId, id),
            q.excludeWorkoutId
              ? ne(workouts.id, q.excludeWorkoutId)
              : undefined,
            q.before ? lt(workouts.startedAt, new Date(q.before)) : undefined,
          );
          const filter = and(
            baseFilter,
            q.allMeasurements === "true"
              ? undefined
              : sql`${effectiveType} = ${mode}`,
          );
          const available = await tx
            .selectDistinct({ loggingType: effectiveType })
            .from(sets)
            .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
            .innerJoin(workouts, eq(entries.workoutId, workouts.id))
            .where(baseFilter)
            .orderBy(effectiveType);
          const rows = await tx
            .select({
              id: workouts.id,
              createdAt: workouts.startedAt,
              title: workouts.title,
              notes: workouts.notes,
              startedAt: workouts.startedAt,
              endedAt: workouts.endedAt,
              ...metrics,
              completedSets:
                sql<number>`count(*) filter (where ${sets.completed} and not ${sets.skipped})`.mapWith(
                  Number,
                ),
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
          const fields =
            q.allMeasurements === "true"
              ? [
                  ...new Set(
                    available.flatMap((row) =>
                      measurementsFor(row.loggingType),
                    ),
                  ),
                ]
              : measurementsFor(mode);
          const measures: ExerciseMeasurement[] = fields.filter(
            (field) => field !== "laps",
          );
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
                reps: sql<
                  number | null
                >`case when ${hasMeasurement("reps")} then ${sets.reps} end`.mapWith(
                  Number,
                ),
                weightKg: sql<
                  number | null
                >`case when ${hasMeasurement("load")} then ${sets.weightKg} end`.mapWith(
                  Number,
                ),
                durationSeconds: sql<
                  number | null
                >`case when ${hasMeasurement("duration")} then ${sets.durationSeconds} end`.mapWith(
                  Number,
                ),
                distanceMeters: sql<
                  number | null
                >`case when ${hasMeasurement("distance")} then ${sets.distanceMeters} end`.mapWith(
                  Number,
                ),
                laps: sql<
                  number | null
                >`case when ${hasMeasurement("laps")} then ${sets.laps} end`.mapWith(
                  Number,
                ),
              })
              .from(sets)
              .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
              .innerJoin(workouts, eq(entries.workoutId, workouts.id))
              .where(and(filter, hasMeasurement(metric), isNotNull(value)))
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
                  loggingType: effectiveType,
                  completed: sets.completed,
                  skipped: sets.skipped,
                  exerciseNotes: entries.notes,
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
            availableMeasurementTypes: available.map((row) => row.loggingType),
            records,
            sessions: {
              ...page,
              items: page.items.map((row) => ({
                ...row,
                exerciseNotes: [
                  ...new Set(
                    recordedSets
                      .filter((set) => set.workoutId === row.id)
                      .flatMap((set) =>
                        set.exerciseNotes ? [set.exerciseNotes] : [],
                      ),
                  ),
                ],
                sets: recordedSets
                  .filter((set) => set.workoutId === row.id)
                  .map((set) =>
                    set.completed && !set.skipped
                      ? set
                      : {
                          ...set,
                          reps: null,
                          weightKg: null,
                          durationSeconds: null,
                          distanceMeters: null,
                          laps: null,
                        },
                  ),
              })),
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    async weightRecords(u: string, id: string, q: WeightRecordsQuery) {
      const rows = await db
        .selectDistinctOn([sets.weightKg], {
          value: sets.reps,
          totalReps:
            sql<number>`sum(${sets.reps}) over (partition by ${sets.weightKg})`.mapWith(
              Number,
            ),
          workoutId: workouts.id,
          workoutTitle: workouts.title,
          startedAt: workouts.startedAt,
          setId: sets.id,
          reps: sets.reps,
          weightKg: sets.weightKg,
          durationSeconds: sql<
            number | null
          >`case when ${hasMeasurement("duration")} then ${sets.durationSeconds} end`.mapWith(
            Number,
          ),
          distanceMeters: sql<
            number | null
          >`case when ${hasMeasurement("distance")} then ${sets.distanceMeters} end`.mapWith(
            Number,
          ),
          laps: sql<
            number | null
          >`case when ${hasMeasurement("laps")} then ${sets.laps} end`.mapWith(
            Number,
          ),
        })
        .from(sets)
        .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
        .innerJoin(workouts, eq(entries.workoutId, workouts.id))
        .where(
          and(
            scope(u),
            eq(entries.exerciseId, id),
            weightedReps,
            isNotNull(sets.reps),
            isNotNull(sets.weightKg),
            q.beforeWeight === undefined
              ? undefined
              : lt(sets.weightKg, q.beforeWeight),
          ),
        )
        .orderBy(
          desc(sets.weightKg),
          desc(sets.reps),
          asc(workouts.startedAt),
          asc(workouts.id),
          asc(entries.position),
          asc(sets.position),
        )
        .limit(q.limit + 1);
      const items = rows.slice(0, q.limit).map((row) => ({
        ...row,
        metric: "repsAtWeight" as const,
        value: row.value!,
        reps: row.reps!,
        weightKg: row.weightKg!,
      }));
      return {
        items,
        nextWeight: rows.length > q.limit ? items.at(-1)!.weightKg : null,
      };
    },
    async workoutRecords(u: string, id: string, startedAt: Date) {
      const priorSets = alias(sets, "prior_record_sets");
      const priorEntries = alias(entries, "prior_record_entries");
      const priorWorkouts = alias(workouts, "prior_record_workouts");
      const records: WorkoutRecords["records"] = [];
      return db.transaction(
        async (tx) => {
          for (const metric of [
            "load",
            "reps",
            "repsAtWeight",
            "duration",
            "distance",
          ] as const) {
            const field = metric === "repsAtWeight" ? "reps" : metric;
            const key = {
              load: "weightKg",
              reps: "reps",
              duration: "durationSeconds",
              distance: "distanceMeters",
            }[field] as
              "weightKg" | "reps" | "durationSeconds" | "distanceMeters";
            const priorType = sql`coalesce(${priorSets.measurementOverride}, ${priorEntries.loggingType})`;
            const previous = tx
              .select({
                value: sql<number | null>`max(${priorSets[key]})`.mapWith(
                  Number,
                ),
              })
              .from(priorSets)
              .innerJoin(
                priorEntries,
                eq(priorSets.workoutExerciseId, priorEntries.id),
              )
              .innerJoin(
                priorWorkouts,
                eq(priorEntries.workoutId, priorWorkouts.id),
              )
              .where(
                and(
                  eq(priorSets.userId, u),
                  eq(priorEntries.userId, u),
                  eq(priorWorkouts.userId, u),
                  eq(priorSets.completed, true),
                  eq(priorSets.skipped, false),
                  isNotNull(priorWorkouts.endedAt),
                  eq(priorEntries.exerciseId, entries.exerciseId),
                  sql`(${priorWorkouts.startedAt}, ${priorWorkouts.id}) < (${startedAt.toISOString()}::timestamptz, ${id}::uuid)`,
                  sql`${field} = any(string_to_array(${priorType}, '_'))`,
                  metric === "repsAtWeight"
                    ? sql`'load' = any(string_to_array(${priorType}, '_')) and ${priorSets.weightKg} = ${sets.weightKg}`
                    : undefined,
                ),
              );
            const buckets =
              metric === "repsAtWeight"
                ? [entries.exerciseId, sets.weightKg]
                : [entries.exerciseId];
            const rows = await tx
              .selectDistinctOn(buckets, {
                exerciseId: entries.exerciseId,
                workoutExerciseId: entries.id,
                setId: sets.id,
                value: sets[key],
                reps: sql<
                  number | null
                >`case when ${hasMeasurement("reps")} then ${sets.reps} end`.mapWith(
                  Number,
                ),
                weightKg: sql<
                  number | null
                >`case when ${hasMeasurement("load")} then ${sets.weightKg} end`.mapWith(
                  Number,
                ),
                previousValue: sql<number | null>`(${previous})`.mapWith(
                  Number,
                ),
              })
              .from(sets)
              .innerJoin(entries, eq(sets.workoutExerciseId, entries.id))
              .innerJoin(workouts, eq(entries.workoutId, workouts.id))
              .where(
                and(
                  scope(u),
                  eq(workouts.id, id),
                  hasMeasurement(field),
                  isNotNull(sets[key]),
                  metric === "repsAtWeight"
                    ? and(weightedReps, isNotNull(sets.weightKg))
                    : undefined,
                ),
              )
              .orderBy(
                ...buckets.map((column) => asc(column)),
                desc(sets[key]),
                asc(entries.position),
                asc(sets.position),
              );
            for (const row of rows)
              if (row.previousValue === null || row.value! > row.previousValue)
                records.push({
                  exerciseId: row.exerciseId,
                  workoutExerciseId: row.workoutExerciseId,
                  setId: row.setId,
                  metric,
                  value: row.value!,
                  reps: row.reps,
                  weightKg: row.weightKg,
                  first: row.previousValue === null,
                });
          }
          return { records };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async previousMatching(u: string, id: string, startedAt: Date) {
      // Match the multiset of exercise identities and captured measurements; order may change.
      const entrySignature = sql`${entries.exerciseId}::text || ':' || ${entries.loggingType} || coalesce((select ':' || string_agg(coalesce(${sets.measurementOverride}, ${entries.loggingType}), ';' order by ${sets.position}) from ${sets} where ${sets.workoutExerciseId} = ${entries.id} and ${sets.userId} = ${u} having bool_or(${sets.measurementOverride} is not null)), '')`;
      const signature = (workout: typeof workouts.id | string) =>
        sql`(select string_agg(${entrySignature}, ',' order by ${entrySignature}) from ${entries} where ${entries.workoutId} = ${workout} and ${entries.userId} = ${u})`;
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
