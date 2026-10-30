import { AppError } from "../../shared/errors/app-error.js";
import { CALENDAR_ACTIVITY_LIMIT } from "@168hours/contracts";
import {
  getTableColumns,
  and,
  gte,
  gt,
  lt,
  or,
  eq,
  ne,
  asc,
  desc,
  inArray,
  isNotNull,
  isNull,
  ilike,
  sql,
} from "drizzle-orm";
import type {
  Database,
  Transaction,
} from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type {
  StrengthProgressQuery,
  WorkoutHistoryQuery,
  WorkoutStartInput,
  WorkoutStartingSetup,
  WorkoutUpdateInput,
} from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import {
  strengthWorkouts as workouts,
  workoutExercises,
  strengthSets,
} from "./exercise.table.js";
export function strengthRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(workouts.userId, u), eq(workouts.id, id));
  async function read(
    tx: Database | Transaction,
    u: string,
    id: string,
    lock = false,
  ) {
    const query = tx.select().from(workouts).where(owned(u, id));
    const row = (await (lock ? query.for("update") : query))[0];
    if (!row) return undefined;
    const exercises = await tx
      .select()
      .from(workoutExercises)
      .where(
        and(eq(workoutExercises.userId, u), eq(workoutExercises.workoutId, id)),
      )
      .orderBy(asc(workoutExercises.position));
    const sets = exercises.length
      ? await tx
          .select()
          .from(strengthSets)
          .where(
            and(
              eq(strengthSets.userId, u),
              inArray(
                strengthSets.workoutExerciseId,
                exercises.map((e) => e.id),
              ),
            ),
          )
          .orderBy(asc(strengthSets.position))
      : [];
    return {
      ...row,
      exercises: exercises.map((e) => ({
        ...e,
        sets: sets.filter((s) => s.workoutExerciseId === e.id),
      })),
    };
  }
  function get(
    u: string,
    id: string,
    context?: TransactionContext,
    lock = false,
  ) {
    if (context) return read(databaseFor(db, context), u, id, lock);
    return db.transaction((tx) => read(tx, u, id), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }
  return {
    async setStartingSetup(
      u: string,
      id: string,
      setup: WorkoutStartingSetup,
      context: TransactionContext,
    ) {
      await databaseFor(db, context)
        .update(workouts)
        .set({ startingSetup: setup })
        .where(owned(u, id));
      return get(u, id, context);
    },
    async capturePlanLinks(u: string, id: string, context: TransactionContext) {
      const rows = await databaseFor(db, context)
        .select({ id: workouts.id, version: workouts.version })
        .from(workouts)
        .where(and(eq(workouts.userId, u), eq(workouts.linkedTimeBlockId, id)))
        .for("update");
      return rows.map((row) => ({
        kind: "strength" as const,
        id: row.id,
        version: row.version + 1,
      }));
    },
    async restorePlanLink(
      u: string,
      blockId: string,
      link: { id: string; version: number },
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const row = (
        await tx
          .select()
          .from(workouts)
          .where(and(eq(workouts.userId, u), eq(workouts.id, link.id)))
          .for("update")
      )[0];
      if (
        !row ||
        row.version !== link.version ||
        row.linkedTimeBlockId !== null
      )
        throw new AppError(
          409,
          "UNDO_CONFLICT",
          "Linked activity changed since deletion. This block cannot be restored safely.",
        );
      await tx
        .update(workouts)
        .set({ linkedTimeBlockId: blockId })
        .where(and(eq(workouts.userId, u), eq(workouts.id, link.id)));
    },

    activityRange: (u: string, start: string, end: string) =>
      db
        .select()
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, u),
            or(
              gte(workouts.startedAt, new Date(start)),
              gt(workouts.endedAt, new Date(start)),
            ),
            lt(workouts.startedAt, new Date(end)),
          ),
        )
        .orderBy(asc(workouts.startedAt), asc(workouts.id))
        .limit(CALENDAR_ACTIVITY_LIMIT + 1),
    get,
    async start(u: string, v: WorkoutStartInput, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .insert(workouts)
          .values({
            ...v,
            userId: u,
            startedAt: new Date(v.startedAt),
            startingSetup: { title: v.title, notes: v.notes, exercises: [] },
          })
          .returning()
      )[0]!;
    },
    async list(u: string, q: WorkoutHistoryQuery) {
      const rows = await db
        .select({
          ...getTableColumns(workouts),
          exerciseCount: sql<number>`(select count(*)::int from strength_workout_exercises e
            where e.workout_id = "strength_workouts"."id" and e.user_id = ${u})`,
          completedSetCount: sql<number>`(select count(*)::int from strength_sets s
            inner join strength_workout_exercises e on e.id = s.workout_exercise_id and e.user_id = ${u}
            where e.workout_id = "strength_workouts"."id" and s.user_id = ${u}
            and s.completed = true and s.skipped = false)`,
        })
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, u),
            q.search
              ? ilike(
                  workouts.title,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            q.status === "active"
              ? isNull(workouts.endedAt)
              : q.status === "completed"
                ? isNotNull(workouts.endedAt)
                : undefined,
            cursorCondition(q, workouts.startedAt, workouts.id),
          ),
        )
        .orderBy(desc(workouts.startedAt), desc(workouts.id))
        .limit(q.limit + 1);
      const page = pageResult(
        rows.map((row) => ({ id: row.id, createdAt: row.startedAt })),
        q.limit,
      );
      return { items: rows.slice(0, q.limit), nextCursor: page.nextCursor };
    },
    async replace(
      context: TransactionContext,
      u: string,
      id: string,
      v: WorkoutUpdateInput,
      names: string[],
      loggingTypes: import("@168hours/contracts").ExerciseLoggingType[],
      intents: string[][],
      previous: NonNullable<Awaited<ReturnType<typeof get>>>,
    ) {
      const tx = databaseFor(db, context);
      await tx
        .update(workouts)
        .set({
          title: v.title,
          pauses: v.pauses ?? [],
          startedAt: new Date(v.startedAt),
          endedAt: v.endedAt ? new Date(v.endedAt) : null,
          notes: v.notes,
          linkedTimeBlockId: v.linkedTimeBlockId,
          updatedAt: new Date(),
        })
        .where(owned(u, id));
      await tx
        .delete(workoutExercises)
        .where(
          and(
            eq(workoutExercises.userId, u),
            eq(workoutExercises.workoutId, id),
          ),
        );
      for (const [position, e] of v.exercises.entries()) {
        const old = previous.exercises.find((item) => item.id === e.id);
        const row = (
          await tx
            .insert(workoutExercises)
            .values({
              id: e.id,
              createdAt: old?.createdAt,
              version: old ? old.version + 1 : 1,
              userId: u,
              workoutId: id,
              exerciseId: e.exerciseId,
              exerciseNameSnapshot: names[position]!,
              loggingType: loggingTypes[position]!,
              intentTags: intents[position]!,
              position,
              notes: e.notes,
            })
            .returning()
        )[0]!;
        if (e.sets.length)
          await tx.insert(strengthSets).values(
            e.sets.map((s, position) => {
              const oldSet = old?.sets.find((item) => item.id === s.id);
              return {
                ...s,
                createdAt: oldSet?.createdAt,
                version: oldSet ? oldSet.version + 1 : 1,
                userId: u,
                workoutExerciseId: row.id,
                position,
              };
            }),
          );
      }
      return get(u, id, context);
    },
    async remove(context: TransactionContext, u: string, id: string) {
      const tx = databaseFor(db, context);
      return (await tx.delete(workouts).where(owned(u, id)).returning())[0];
    },
    async latest(u: string) {
      return (
        (
          await db
            .select()
            .from(workouts)
            .where(and(eq(workouts.userId, u), isNotNull(workouts.endedAt)))
            .orderBy(desc(workouts.startedAt), desc(workouts.id))
            .limit(1)
        )[0] ?? null
      );
    },
    async progress(u: string, exerciseId: string, q: StrengthProgressQuery) {
      return db.transaction(
        async (tx) => {
          const scope = and(
            eq(strengthSets.userId, u),
            eq(workoutExercises.userId, u),
            eq(workouts.userId, u),
            eq(workoutExercises.exerciseId, exerciseId),
            eq(strengthSets.completed, true),
            isNotNull(workouts.endedAt),
            q.excludeWorkoutId
              ? ne(workouts.id, q.excludeWorkoutId)
              : undefined,
          );
          const rows = await tx
            .select({
              id: strengthSets.id,
              createdAt: strengthSets.createdAt,
              workoutId: workouts.id,
              startedAt: workouts.startedAt,
              exerciseNameSnapshot: workoutExercises.exerciseNameSnapshot,
              reps: strengthSets.reps,
              weightKg: strengthSets.weightKg,
              durationSeconds: strengthSets.durationSeconds,
              distanceMeters: strengthSets.distanceMeters,
              laps: strengthSets.laps,
            })
            .from(strengthSets)
            .innerJoin(
              workoutExercises,
              eq(strengthSets.workoutExerciseId, workoutExercises.id),
            )
            .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
            .where(
              and(
                scope,
                cursorCondition(q, strengthSets.createdAt, strengthSets.id),
              ),
            )
            .orderBy(desc(strengthSets.createdAt), desc(strengthSets.id))
            .limit(q.limit + 1);
          const [max] = await tx
            .select({
              weight: sql<number | null>`max(${strengthSets.weightKg})`.mapWith(
                Number,
              ),
            })
            .from(strengthSets)
            .innerJoin(
              workoutExercises,
              eq(strengthSets.workoutExerciseId, workoutExercises.id),
            )
            .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
            .where(scope);
          return {
            maxWeightKg: max?.weight ?? null,
            history: pageResult(rows, q.limit),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
