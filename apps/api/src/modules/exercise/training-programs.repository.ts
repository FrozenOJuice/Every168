import { and, eq, desc, sql } from "drizzle-orm";
import type { PageQuery, TrainingProgramQuery } from "@168hours/contracts";
import type {
  Database,
  Transaction,
} from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import type { TransactionContext } from "../../shared/transactions.js";
import {
  trainingPrograms as programs,
  programOccurrences as occurrences,
} from "./training-programs.table.js";
import {
  strengthPlans as plans,
  strengthWorkouts as workouts,
} from "./exercise.table.js";
type ProgramValues = typeof programs.$inferInsert;
type OccurrenceValues = typeof occurrences.$inferInsert;
export function trainingProgramsRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(programs.userId, u), eq(programs.id, id));
  const occurrenceRows = (tx: Database | Transaction) =>
    tx
      .select({
        occurrence: occurrences,
        plan: plans,
        session: {
          id: workouts.id,
          startedAt: workouts.startedAt,
          endedAt: workouts.endedAt,
        },
      })
      .from(occurrences)
      .leftJoin(
        plans,
        and(
          eq(plans.id, occurrences.planId),
          eq(plans.userId, occurrences.userId),
        ),
      )
      .leftJoin(
        workouts,
        and(
          eq(workouts.id, plans.sessionId),
          eq(workouts.userId, occurrences.userId),
        ),
      );
  async function read(
    tx: Database | Transaction,
    u: string,
    id: string,
    lock = false,
  ) {
    const query = tx.select().from(programs).where(owned(u, id));
    const [program] = await (lock ? query.for("update") : query);
    if (!program) return undefined;
    const [latest] = await occurrenceRows(tx)
      .where(and(eq(occurrences.userId, u), eq(occurrences.programId, id)))
      .orderBy(desc(occurrences.sequence))
      .limit(1);
    const [counts] = await tx
      .select({
        completedCount:
          sql<number>`count(*) filter (where ${occurrences.skippedAt} is null and ${workouts.endedAt} is not null)`.mapWith(
            Number,
          ),
        skippedCount:
          sql<number>`count(*) filter (where ${occurrences.skippedAt} is not null)`.mapWith(
            Number,
          ),
      })
      .from(occurrences)
      .leftJoin(
        plans,
        and(eq(plans.id, occurrences.planId), eq(plans.userId, u)),
      )
      .leftJoin(
        workouts,
        and(eq(workouts.id, plans.sessionId), eq(workouts.userId, u)),
      )
      .where(and(eq(occurrences.userId, u), eq(occurrences.programId, id)));
    return { program, latest: latest ?? null, counts: counts! };
  }
  return {
    async get(u: string, id: string, context?: TransactionContext) {
      return context
        ? read(databaseFor(db, context), u, id, true)
        : db.transaction((tx) => read(tx, u, id), {
            isolationLevel: "repeatable read",
            accessMode: "read only",
          });
    },
    async list(u: string, q: TrainingProgramQuery) {
      const rows = await db
        .select()
        .from(programs)
        .where(
          and(
            eq(programs.userId, u),
            q.paused === "all"
              ? undefined
              : eq(programs.paused, q.paused === "paused"),
            cursorCondition(q, programs.createdAt, programs.id),
          ),
        )
        .orderBy(desc(programs.createdAt), desc(programs.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async history(u: string, id: string, q: PageQuery) {
      const rows = await occurrenceRows(db)
        .where(
          and(
            eq(occurrences.userId, u),
            eq(occurrences.programId, id),
            cursorCondition(q, occurrences.createdAt, occurrences.id),
          ),
        )
        .orderBy(desc(occurrences.createdAt), desc(occurrences.id))
        .limit(q.limit + 1);
      return pageResult(
        rows.map((row) => ({ ...row, ...row.occurrence })),
        q.limit,
      );
    },
    async create(
      u: string,
      v: Omit<ProgramValues, "userId">,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(programs)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<
        Pick<
          ProgramValues,
          "title" | "notes" | "startDate" | "trainingDays" | "paused" | "steps"
        >
      >,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .update(programs)
          .set({ ...v, updatedAt: new Date() })
          .where(owned(u, id))
          .returning()
      )[0]!;
    },
    async remove(u: string, id: string, ctx: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .delete(programs)
          .where(owned(u, id))
          .returning()
      )[0];
    },
    async createOccurrence(
      u: string,
      v: Omit<OccurrenceValues, "userId">,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(occurrences)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateOccurrence(
      u: string,
      id: string,
      v: Partial<
        Pick<OccurrenceValues, "plannedDate" | "skippedAt" | "planId">
      >,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .update(occurrences)
          .set(v)
          .where(and(eq(occurrences.userId, u), eq(occurrences.id, id)))
          .returning()
      )[0]!;
    },
    async linkForSession(u: string, id: string) {
      return (
        (
          await db
            .select({ programId: programs.id, title: programs.title })
            .from(occurrences)
            .innerJoin(
              programs,
              and(
                eq(programs.id, occurrences.programId),
                eq(programs.userId, u),
              ),
            )
            .innerJoin(
              plans,
              and(eq(plans.id, occurrences.planId), eq(plans.userId, u)),
            )
            .where(and(eq(occurrences.userId, u), eq(plans.sessionId, id)))
            .limit(1)
        )[0] ?? null
      );
    },
  };
}
