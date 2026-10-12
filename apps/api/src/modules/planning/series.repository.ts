import { and, eq } from "drizzle-orm";
import {
  blockSchema,
  seriesSchema,
  type SeriesInput,
  type BlockInput,
  type Block,
  type CalendarSeries,
} from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import {
  calendarSeries as t,
  calendarSeriesChanges as changes,
} from "./calendar.table.js";
import { timeBlocks } from "./planning.table.js";
export function seriesRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    async recordChange(
      u: string,
      seriesId: string,
      before: CalendarSeries | null,
      beforeBlocks: Block[],
      after: CalendarSeries | null,
      afterBlocks: Block[],
      removedBlockUndoIds: string[],
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(changes)
          .values({
            userId: u,
            seriesId,
            before,
            beforeBlocks,
            after,
            afterBlocks,
            removedBlockUndoIds,
          })
          .returning()
      )[0]!;
    },
    async change(u: string, id: string, ctx: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .select()
          .from(changes)
          .where(and(eq(changes.userId, u), eq(changes.id, id)))
          .for("update")
      )[0];
    },
    async consumeChange(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx)
        .delete(changes)
        .where(and(eq(changes.userId, u), eq(changes.id, id)));
    },
    async snapshot(u: string, id: string, ctx: TransactionContext) {
      const row = await this.get(u, id, ctx);
      return {
        series: row
          ? seriesSchema.parse(JSON.parse(JSON.stringify(row)))
          : null,
        blocks: (await this.blocks(u, id, ctx)).map((block) =>
          blockSchema.parse(JSON.parse(JSON.stringify(block))),
        ),
      };
    },
    async restoreDefinition(
      u: string,
      before: CalendarSeries,
      ctx: TransactionContext,
    ) {
      const {
        id,
        version,
        createdAt,
        updatedAt: _updatedAt,
        ...values
      } = before;
      if (await this.get(u, id, ctx))
        await databaseFor(db, ctx).update(t).set(values).where(owned(u, id));
      else
        await databaseFor(db, ctx)
          .insert(t)
          .values({
            ...values,
            id,
            userId: u,
            version: version + 1,
            createdAt: new Date(createdAt),
          });
    },
    async restoreOccurrence(u: string, block: Block, ctx: TransactionContext) {
      const {
        id,
        version: _version,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        seriesId: _seriesId,
        occurrenceDate: _occurrenceDate,
        ...values
      } = block;
      await databaseFor(db, ctx)
        .update(timeBlocks)
        .set({
          ...values,
          startsAt: new Date(block.startsAt),
          endsAt: new Date(block.endsAt),
        })
        .where(and(eq(timeBlocks.userId, u), eq(timeBlocks.id, id)));
    },
    async get(u: string, id: string, ctx?: TransactionContext) {
      const q = databaseFor(db, ctx).select().from(t).where(owned(u, id));
      return (await (ctx ? q.for("update") : q))[0];
    },
    async create(u: string, v: SeriesInput, ctx: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .insert(t)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: SeriesInput,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .update(t)
          .set(v)
          .where(owned(u, id))
          .returning()
      )[0]!;
    },
    async resetExcluded(
      u: string,
      id: string,
      excludedDates: string[],
      ctx: TransactionContext,
    ) {
      await databaseFor(db, ctx)
        .update(t)
        .set({ excludedDates })
        .where(owned(u, id));
    },
    async remove(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx).delete(t).where(owned(u, id));
    },
    blocks(u: string, id: string, ctx: TransactionContext) {
      return databaseFor(db, ctx)
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, u), eq(timeBlocks.seriesId, id)))
        .orderBy(timeBlocks.occurrenceDate)
        .for("update");
    },
    async insertBlock(
      u: string,
      seriesId: string,
      occurrenceDate: string,
      v: BlockInput,
      ctx: TransactionContext,
    ) {
      await databaseFor(db, ctx)
        .insert(timeBlocks)
        .values({
          ...v,
          userId: u,
          seriesId,
          occurrenceDate,
          startsAt: new Date(v.startsAt),
          endsAt: new Date(v.endsAt),
        });
    },
    async replaceBlock(
      u: string,
      id: string,
      v: BlockInput,
      ctx: TransactionContext,
    ) {
      await databaseFor(db, ctx)
        .update(timeBlocks)
        .set({
          ...v,
          isException: false,
          startsAt: new Date(v.startsAt),
          endsAt: new Date(v.endsAt),
        })
        .where(and(eq(timeBlocks.userId, u), eq(timeBlocks.id, id)));
    },
  };
}
