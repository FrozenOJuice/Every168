import { CALENDAR_ACTIVITY_LIMIT } from "@168hours/contracts";
import { and, eq, asc, desc, ilike, lt, sql } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { CardioInput, CardioHistoryQuery } from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { cardioActivities as table } from "./exercise.table.js";
export function cardioRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(table.userId, u), eq(table.id, id));
  return {
    activityRange: (u: string, start: string, end: string) =>
      db
        .select()
        .from(table)
        .where(
          and(
            eq(table.userId, u),
            sql`${table.startedAt} + ${table.durationSeconds} * interval '1 second' > ${new Date(start)}`,
            lt(table.startedAt, new Date(end)),
          ),
        )
        .orderBy(asc(table.startedAt), asc(table.id))
        .limit(CALENDAR_ACTIVITY_LIMIT + 1),
    async get(
      u: string,
      id: string,
      context?: TransactionContext,
      lock = false,
    ) {
      const tx = databaseFor(db, context);
      const q = tx.select().from(table).where(owned(u, id));
      return (await (lock ? q.for("update") : q))[0];
    },
    async create(context: TransactionContext, u: string, v: CardioInput) {
      const tx = databaseFor(db, context);
      return (
        await tx
          .insert(table)
          .values({ ...v, userId: u, startedAt: new Date(v.startedAt) })
          .returning()
      )[0]!;
    },
    async update(
      context: TransactionContext,
      u: string,
      id: string,
      v: CardioInput,
    ) {
      const tx = databaseFor(db, context);
      return (
        await tx
          .update(table)
          .set({
            ...v,
            startedAt: new Date(v.startedAt),
            updatedAt: new Date(),
          })
          .where(owned(u, id))
          .returning()
      )[0];
    },
    async remove(context: TransactionContext, u: string, id: string) {
      const tx = databaseFor(db, context);
      return (await tx.delete(table).where(owned(u, id)).returning())[0];
    },
    async list(u: string, q: CardioHistoryQuery) {
      const rows = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.userId, u),
            q.search
              ? ilike(
                  table.title,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            q.activityType ? eq(table.activityType, q.activityType) : undefined,
            cursorCondition(q, table.createdAt, table.id),
          ),
        )
        .orderBy(desc(table.createdAt), desc(table.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async latest(u: string) {
      return (
        (
          await db
            .select()
            .from(table)
            .where(eq(table.userId, u))
            .orderBy(desc(table.startedAt), desc(table.id))
            .limit(1)
        )[0] ?? null
      );
    },
  };
}
