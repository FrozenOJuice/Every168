import { and, eq, inArray, or, isNull } from "drizzle-orm";
import {
  blockSchema,
  calendarItemSchema,
  type CalendarItem,
  seriesSchema,
  type SeriesInput,
  type BlockInput,
  type Block,
  type CalendarSeries,
} from "@168hours/contracts";
import { addDays } from "@168hours/domain-utils";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import {
  calendarSeries as t,
  calendarSeriesChanges as changes,
} from "./calendar.table.js";
import { calendarItems } from "./calendar.table.js";
import type { SeriesSnapshot } from "./planning.types.js";
import { timeBlocks } from "./planning.table.js";
export function seriesRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    async recordChange(
      u: string,
      seriesId: string,
      before: SeriesSnapshot[],
      after: SeriesSnapshot[],
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
            after,
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
    async snapshot(
      u: string,
      id: string,
      ctx: TransactionContext,
      tracked?: SeriesSnapshot,
    ) {
      const row = await this.get(u, id, ctx);
      const blocks = await databaseFor(db, ctx)
        .select()
        .from(timeBlocks)
        .where(
          and(
            eq(timeBlocks.userId, u),
            or(
              eq(timeBlocks.seriesId, id),
              tracked?.blocks.length
                ? and(
                    isNull(timeBlocks.seriesId),
                    inArray(
                      timeBlocks.id,
                      tracked.blocks.map((b) => b.id),
                    ),
                  )
                : undefined,
            ),
          ),
        )
        .orderBy(timeBlocks.id)
        .for("update");
      const items = await databaseFor(db, ctx)
        .select()
        .from(calendarItems)
        .where(
          and(
            eq(calendarItems.userId, u),
            or(
              eq(calendarItems.seriesId, id),
              tracked?.items.length
                ? and(
                    isNull(calendarItems.seriesId),
                    inArray(
                      calendarItems.id,
                      tracked.items.map((b) => b.id),
                    ),
                  )
                : undefined,
            ),
          ),
        )
        .orderBy(calendarItems.id)
        .for("update");
      return {
        id,
        series: row
          ? seriesSchema.parse(JSON.parse(JSON.stringify(row)))
          : null,
        blocks: blocks.map((block) =>
          blockSchema.parse(JSON.parse(JSON.stringify(block))),
        ),
        items: items.map((item) =>
          calendarItemSchema.parse(JSON.parse(JSON.stringify(item))),
        ),
      };
    },
    async saveItem(u: string, item: CalendarItem, ctx: TransactionContext) {
      const { id, version, createdAt, updatedAt: _updatedAt, ...values } = item;
      const existing = (
        await databaseFor(db, ctx)
          .select()
          .from(calendarItems)
          .where(and(eq(calendarItems.userId, u), eq(calendarItems.id, id)))
          .for("update")
      )[0];
      if (existing)
        await databaseFor(db, ctx)
          .update(calendarItems)
          .set(values)
          .where(and(eq(calendarItems.userId, u), eq(calendarItems.id, id)));
      else
        await databaseFor(db, ctx)
          .insert(calendarItems)
          .values({
            ...values,
            id,
            userId: u,
            version: version + 1,
            createdAt: new Date(createdAt),
          });
    },
    async removeItem(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx)
        .delete(calendarItems)
        .where(and(eq(calendarItems.userId, u), eq(calendarItems.id, id)));
    },
    async insertItem(
      u: string,
      seriesId: string,
      occurrenceDate: string,
      v: SeriesInput,
      ctx: TransactionContext,
    ) {
      await databaseFor(db, ctx)
        .insert(calendarItems)
        .values({
          userId: u,
          seriesId,
          occurrenceDate,
          kind: "all_day",
          date: occurrenceDate,
          endDate: addDays(occurrenceDate, v.dateSpan - 1),
          title: v.title,
          notes: v.notes,
          categoryId: v.categoryId,
          goalId: v.goalId,
        });
    },
    async replaceItem(
      u: string,
      id: string,
      occurrenceDate: string,
      v: SeriesInput,
      ctx: TransactionContext,
    ) {
      await databaseFor(db, ctx)
        .update(calendarItems)
        .set({
          date: occurrenceDate,
          endDate: addDays(occurrenceDate, v.dateSpan - 1),
          title: v.title,
          notes: v.notes,
          categoryId: v.categoryId,
          goalId: v.goalId,
          isException: false,
        })
        .where(and(eq(calendarItems.userId, u), eq(calendarItems.id, id)));
    },
    async attach(
      u: string,
      kind: "block" | "item",
      id: string,
      seriesId: string,
      occurrenceDate: string,
      ctx: TransactionContext,
    ) {
      const table = kind === "block" ? timeBlocks : calendarItems;
      await databaseFor(db, ctx)
        .update(table)
        .set({ seriesId, occurrenceDate, isException: false })
        .where(and(eq(table.userId, u), eq(table.id, id)));
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
