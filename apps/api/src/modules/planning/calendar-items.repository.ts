import { and, eq, isNull, lte, gte, or, desc } from "drizzle-orm";
import type {
  CalendarItem,
  CalendarItemInput,
  PageQuery,
} from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { changed } from "../../shared/errors/revision.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { calendarItems as t } from "./calendar.table.js";
export function calendarItemsRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    async get(u: string, id: string, context?: TransactionContext) {
      const q = databaseFor(db, context).select().from(t).where(owned(u, id));
      return (await (context ? q.for("update") : q))[0];
    },
    range(u: string, from: string, to: string) {
      return db
        .select()
        .from(t)
        .where(
          and(
            eq(t.userId, u),
            lte(t.date, to),
            or(gte(t.endDate, from), and(isNull(t.endDate), gte(t.date, from))),
          ),
        )
        .orderBy(t.date, t.id);
    },
    async backlog(u: string, q: PageQuery) {
      const rows = await db
        .select()
        .from(t)
        .where(
          and(
            eq(t.userId, u),
            isNull(t.date),
            cursorCondition(q, t.createdAt, t.id),
          ),
        )
        .orderBy(desc(t.createdAt), desc(t.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async create(
      u: string,
      input: CalendarItemInput,
      context?: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(t)
          .values({ ...input, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      input: CalendarItemInput,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(t)
          .set(input)
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, context));
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .delete(t)
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, context));
    },
    async restore(
      u: string,
      snapshot: CalendarItem,
      context: TransactionContext,
    ) {
      if (await this.get(u, snapshot.id, context))
        throw new AppError(409, "UNDO_CONFLICT", "This plan already exists.");
      return (
        await databaseFor(db, context)
          .insert(t)
          .values({
            ...snapshot,
            userId: u,
            version: snapshot.version + 1,
            createdAt: new Date(snapshot.createdAt),
            updatedAt: new Date(),
          })
          .returning()
      )[0]!;
    },
  };
}
