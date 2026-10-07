import { count } from "drizzle-orm";
import { assertRevision, changed } from "../../shared/errors/revision.js";
import {
  databaseFor,
  transactionRunner,
} from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { and, eq, lt, gt, asc, sql } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type { BlockInput, TimeEntryInput } from "@168hours/contracts";
import { calendarSeries } from "./calendar.table.js";
import { timeBlocks, timeEntries } from "./planning.table.js";
export function planningRepository(db: Database) {
  const blockOwner = (u: string, id: string) =>
    and(eq(timeBlocks.userId, u), eq(timeBlocks.id, id));
  const entryOwner = (u: string, id: string) =>
    and(eq(timeEntries.userId, u), eq(timeEntries.id, id));
  async function lockFamily(
    u: string,
    id: string,
    context: TransactionContext,
  ) {
    const tx = databaseFor(db, context);
    const row = (
      await tx
        .select({ seriesId: timeBlocks.seriesId })
        .from(timeBlocks)
        .where(blockOwner(u, id))
    )[0];
    if (row?.seriesId)
      await tx
        .select()
        .from(calendarSeries)
        .where(
          and(
            eq(calendarSeries.userId, u),
            eq(calendarSeries.id, row.seriesId),
          ),
        )
        .for("update");
  }
  return {
    async platformUsage() {
      const plannedBlocks = (
        await db.select({ total: count() }).from(timeBlocks)
      )[0]!.total;
      return { plannedBlocks };
    },
    async getBlock(u: string, id: string, context?: TransactionContext) {
      const tx = databaseFor(db, context);
      const query = tx.select().from(timeBlocks).where(blockOwner(u, id));
      return (await (context ? query.for("share") : query))[0];
    },
    async weekRecords(u: string, start: string, end: string) {
      return db.transaction(
        async (tx) => {
          const blocks = await tx
            .select()
            .from(timeBlocks)
            .where(
              and(
                eq(timeBlocks.userId, u),
                lt(timeBlocks.startsAt, new Date(end)),
                gt(timeBlocks.endsAt, new Date(start)),
              ),
            )
            .orderBy(asc(timeBlocks.startsAt), asc(timeBlocks.id));
          const entries = await tx
            .select()
            .from(timeEntries)
            .where(
              and(
                eq(timeEntries.userId, u),
                lt(timeEntries.startsAt, new Date(end)),
                gt(timeEntries.endsAt, new Date(start)),
              ),
            )
            .orderBy(asc(timeEntries.startsAt), asc(timeEntries.id));
          return { blocks, entries };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async createBlock(
      u: string,
      input: BlockInput,
      context?: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(timeBlocks)
          .values({
            ...input,
            userId: u,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
          })
          .returning()
      )[0]!;
    },
    async updateBlock(
      u: string,
      id: string,
      input: BlockInput,
      version: number,
      context?: TransactionContext,
    ) {
      return transactionRunner(db)(async (scope) => {
        await lockFamily(u, id, scope);
        const row = (
          await databaseFor(db, scope)
            .update(timeBlocks)
            .set({
              ...input,
              startsAt: new Date(input.startsAt),
              endsAt: new Date(input.endsAt),
              isException: sql`${timeBlocks.seriesId} is not null`,
            })
            .where(and(blockOwner(u, id), eq(timeBlocks.version, version)))
            .returning()
        )[0];
        return changed(row, () => this.getBlock(u, id, scope));
      }, context);
    },
    async deleteBlock(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
      excludeOccurrence = true,
    ) {
      return transactionRunner(db)(async (scope) => {
        await lockFamily(u, id, scope);
        const tx = databaseFor(db, scope);
        const block = assertRevision(
          (
            await tx
              .select()
              .from(timeBlocks)
              .where(blockOwner(u, id))
              .for("update")
          )[0],
          version,
        );
        if (excludeOccurrence && block.seriesId)
          await tx
            .update(calendarSeries)
            .set({
              excludedDates: sql`case when ${block.occurrenceDate}::date=any(${calendarSeries.excludedDates}) then ${calendarSeries.excludedDates} else array_append(${calendarSeries.excludedDates},${block.occurrenceDate}::date) end`,
            })
            .where(
              and(
                eq(calendarSeries.userId, u),
                eq(calendarSeries.id, block.seriesId),
              ),
            );
        await tx
          .update(timeEntries)
          .set({ timeBlockId: null })
          .where(
            and(eq(timeEntries.userId, u), eq(timeEntries.timeBlockId, id)),
          );
        return (
          await tx.delete(timeBlocks).where(blockOwner(u, id)).returning()
        )[0];
      }, context);
    },
    async getEntry(u: string, id: string, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(timeEntries)
          .where(entryOwner(u, id))
      )[0];
    },
    async createEntry(
      u: string,
      input: TimeEntryInput,
      context?: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(timeEntries)
          .values({
            ...input,
            userId: u,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
          })
          .returning()
      )[0]!;
    },
    async updateEntry(
      u: string,
      id: string,
      input: TimeEntryInput,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(timeEntries)
          .set({
            ...input,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            updatedAt: new Date(),
          })
          .where(
            and(
              and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")),
              eq(timeEntries.version, version),
            ),
          )
          .returning()
      )[0];
      return changed(
        row,
        async () =>
          (
            await databaseFor(db, context)
              .select()
              .from(timeEntries)
              .where(
                and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")),
              )
          )[0],
      );
    },
    async deleteEntry(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .delete(timeEntries)
          .where(
            and(
              and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")),
              eq(timeEntries.version, version),
            ),
          )
          .returning()
      )[0];
      return changed(
        row,
        async () =>
          (
            await databaseFor(db, context)
              .select()
              .from(timeEntries)
              .where(
                and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")),
              )
          )[0],
      );
    },
    async upsertSource(
      context: TransactionContext,
      u: string,
      input: TimeEntryInput & {
        sourceType: "strength_workout" | "cardio_activity";
        sourceId: string;
      },
    ) {
      const tx = databaseFor(db, context);
      const values = {
        ...input,
        userId: u,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      };
      return (
        await tx
          .insert(timeEntries)
          .values(values)
          .onConflictDoUpdate({
            target: [
              timeEntries.userId,
              timeEntries.sourceType,
              timeEntries.sourceId,
            ],
            targetWhere: sql`${timeEntries.sourceId} is not null`,
            set: { ...values, updatedAt: new Date() },
          })
          .returning()
      )[0]!;
    },
    removeSource: (
      context: TransactionContext,
      u: string,
      type: "strength_workout" | "cardio_activity",
      id: string,
    ) =>
      databaseFor(db, context)
        .delete(timeEntries)
        .where(
          and(
            eq(timeEntries.userId, u),
            eq(timeEntries.sourceType, type),
            eq(timeEntries.sourceId, id),
          ),
        ),
  };
}
