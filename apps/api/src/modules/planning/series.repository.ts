import { and, eq } from "drizzle-orm";
import type { SeriesInput, BlockInput } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { calendarSeries as t } from "./calendar.table.js";
import { timeBlocks } from "./planning.table.js";
export function seriesRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
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
