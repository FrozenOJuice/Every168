import { and, eq, asc, desc, inArray, isNotNull, sql } from "drizzle-orm";
import type {
  Db,
  Database,
  Transaction,
} from "../../infrastructure/database/client.js";
import type {
  PageQuery,
  WorkoutStartInput,
  WorkoutUpdateInput,
} from "@168hours/contracts";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import {
  strengthWorkouts as workouts,
  workoutExercises,
  strengthSets,
} from "./exercise.table.js";
export function strengthRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(workouts.userId, u), eq(workouts.id, id));
  async function get(u: string, id: string, tx: Db = db, lock = false) {
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
  return {
    get,
    async start(u: string, v: WorkoutStartInput) {
      return (
        await db
          .insert(workouts)
          .values({ ...v, userId: u, startedAt: new Date(v.startedAt) })
          .returning()
      )[0]!;
    },
    async list(u: string, q: PageQuery) {
      const rows = await db
        .select()
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, u),
            cursorCondition(q, workouts.createdAt, workouts.id),
          ),
        )
        .orderBy(desc(workouts.createdAt), desc(workouts.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async replace(
      tx: Transaction,
      u: string,
      id: string,
      v: WorkoutUpdateInput,
      names: string[],
    ) {
      await tx
        .update(workouts)
        .set({
          title: v.title,
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
        const row = (
          await tx
            .insert(workoutExercises)
            .values({
              id: e.id,
              userId: u,
              workoutId: id,
              exerciseId: e.exerciseId,
              exerciseNameSnapshot: names[position]!,
              position,
              notes: e.notes,
            })
            .returning()
        )[0]!;
        if (e.sets.length)
          await tx.insert(strengthSets).values(
            e.sets.map((s, position) => ({
              ...s,
              userId: u,
              workoutExerciseId: row.id,
              position,
            })),
          );
      }
      return get(u, id, tx);
    },
    async remove(tx: Transaction, u: string, id: string) {
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
    async progress(u: string, exerciseId: string, q: PageQuery) {
      const scope = and(
        eq(strengthSets.userId, u),
        eq(workoutExercises.userId, u),
        eq(workouts.userId, u),
        eq(workoutExercises.exerciseId, exerciseId),
        eq(strengthSets.completed, true),
        isNotNull(workouts.endedAt),
      );
      const rows = await db
        .select({
          id: strengthSets.id,
          createdAt: strengthSets.createdAt,
          workoutId: workouts.id,
          startedAt: workouts.startedAt,
          exerciseNameSnapshot: workoutExercises.exerciseNameSnapshot,
          reps: strengthSets.reps,
          weightKg: strengthSets.weightKg,
          durationSeconds: strengthSets.durationSeconds,
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
      const [max] = await db
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
  };
}
