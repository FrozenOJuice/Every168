import { and, eq, isNull, lte, gte, or, desc, sql } from "drizzle-orm";
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
import { seriesSchema } from "@168hours/contracts";
import type { SeriesUndoState } from "./planning.types.js";
import { isDeepStrictEqual } from "node:util";
import { calendarItems as t, calendarSeries } from "./calendar.table.js";
export function calendarItemsRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    async seriesState(
      u: string,
      id: string,
      context: TransactionContext,
    ): Promise<SeriesUndoState | null> {
      const parent = (
        await databaseFor(db, context)
          .select()
          .from(calendarSeries)
          .where(and(eq(calendarSeries.userId, u), eq(calendarSeries.id, id)))
          .for("update")
      )[0];
      if (!parent) return null;
      const {
        version: _v,
        createdAt: _c,
        updatedAt: _t,
        excludedDates: _e,
        ...state
      } = seriesSchema.parse(JSON.parse(JSON.stringify(parent)));
      return state;
    },
    async exclude(
      u: string,
      seriesId: string,
      date: string,
      exclude: boolean,
      context: TransactionContext,
    ) {
      await databaseFor(db, context)
        .update(calendarSeries)
        .set({
          excludedDates: exclude
            ? sql`case when ${date}::date=any(${calendarSeries.excludedDates}) then ${calendarSeries.excludedDates} else array_append(${calendarSeries.excludedDates},${date}::date) end`
            : sql`array_remove(${calendarSeries.excludedDates},${date}::date)`,
        })
        .where(
          and(eq(calendarSeries.userId, u), eq(calendarSeries.id, seriesId)),
        );
    },
    async get(u: string, id: string, context?: TransactionContext) {
      if (context) {
        const candidate = (
          await databaseFor(db, context)
            .select({ seriesId: t.seriesId })
            .from(t)
            .where(owned(u, id))
        )[0];
        if (candidate?.seriesId)
          await this.seriesState(u, candidate.seriesId, context);
      }
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
      input: CalendarItemInput & { isException?: boolean },
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(t)
          .set({
            ...input,
            isException: input.isException ?? sql`${t.seriesId} is not null`,
          })
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
      const previous = await this.get(u, id, context);
      if (previous?.seriesId && context && previous.version === version)
        await this.exclude(
          u,
          previous.seriesId,
          previous.occurrenceDate!,
          true,
          context,
        );
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
      expectedState?: SeriesUndoState,
    ) {
      if (snapshot.seriesId) {
        const state = await this.seriesState(u, snapshot.seriesId, context);
        if (!state || !isDeepStrictEqual(state, expectedState))
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "The repeating plan changed. This deletion cannot be undone safely.",
          );
        await this.exclude(
          u,
          snapshot.seriesId,
          snapshot.occurrenceDate!,
          false,
          context,
        );
      }
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
