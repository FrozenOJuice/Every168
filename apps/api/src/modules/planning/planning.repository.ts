import { isDeepStrictEqual } from "node:util";
import type { BlockSourceLink, SeriesUndoState } from "./planning.types.js";
import { blockSchema } from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import { count } from "drizzle-orm";
import { assertRevision, changed } from "../../shared/errors/revision.js";
import {
  databaseFor,
  transactionRunner,
} from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { and, or, eq, lt, gt, asc, sql, inArray } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type { BlockInput, TimeEntryInput } from "@168hours/contracts";
import { calendarSeries } from "./calendar.table.js";
import {
  timeBlocks,
  timeEntries,
  deletedTimeBlocks,
  editedTimeBlocks,
} from "./planning.table.js";
export function planningRepository(db: Database) {
  const snapshot = (block: typeof timeBlocks.$inferSelect) =>
    blockSchema.parse(JSON.parse(JSON.stringify(block)));
  // Occurrence edits change the parent revision and exclusions, but not its rule.
  const seriesState = (
    series: typeof calendarSeries.$inferSelect,
  ): SeriesUndoState => ({
    id: series.id,
    title: series.title,
    notes: series.notes,
    categoryId: series.categoryId,
    goalId: series.goalId,
    kind: series.kind,
    dateSpan: series.dateSpan,
    timezone: series.timezone,
    startDate: series.startDate,
    untilDate: series.untilDate,
    startMinute: series.startMinute,
    durationMinutes: series.durationMinutes,
    frequency: series.frequency,
    interval: series.interval,
    weekdays: series.weekdays,
  });
  async function checkSeries(
    u: string,
    id: string,
    expected: SeriesUndoState | null,
    context: TransactionContext,
  ) {
    const current = (
      await databaseFor(db, context)
        .select()
        .from(calendarSeries)
        .where(and(eq(calendarSeries.userId, u), eq(calendarSeries.id, id)))
        .for("update")
    )[0];
    if (
      !current ||
      !expected ||
      !isDeepStrictEqual(seriesState(current), expected)
    )
      throw new AppError(
        409,
        "UNDO_CONFLICT",
        "The repeating plan changed. This action cannot be undone safely.",
      );
    return current;
  }
  async function getSeriesState(
    u: string,
    id: string | null,
    context: TransactionContext,
  ) {
    if (!id) return null;
    return seriesState(
      found(
        (
          await databaseFor(db, context)
            .select()
            .from(calendarSeries)
            .where(and(eq(calendarSeries.userId, u), eq(calendarSeries.id, id)))
        )[0],
      ),
    );
  }
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
    blocksByIds(u: string, ids: string[]) {
      return db
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, u), inArray(timeBlocks.id, ids)));
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
    async updateBlockWithUndo(
      u: string,
      id: string,
      input: BlockInput,
      version: number,
      context: TransactionContext,
    ) {
      await lockFamily(u, id, context);
      const tx = databaseFor(db, context);
      const before = assertRevision(
        (
          await tx
            .select()
            .from(timeBlocks)
            .where(blockOwner(u, id))
            .for("update")
        )[0],
        version,
      );
      const after = await this.updateBlock(u, id, input, version, context);
      const receipt = (
        await tx
          .insert(editedTimeBlocks)
          .values({
            userId: u,
            before: snapshot(before),
            after: snapshot(after),
            seriesState: await getSeriesState(u, before.seriesId, context),
          })
          .returning()
      )[0]!;
      return { ...after, undoId: receipt.id };
    },
    async getEdit(u: string, id: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(editedTimeBlocks)
          .where(
            and(eq(editedTimeBlocks.userId, u), eq(editedTimeBlocks.id, id)),
          )
      )[0];
    },
    async undoEdit(
      u: string,
      undoId: string,
      version: number,
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const receipt = found(
        (
          await tx
            .select()
            .from(editedTimeBlocks)
            .where(
              and(
                eq(editedTimeBlocks.userId, u),
                eq(editedTimeBlocks.id, undoId),
              ),
            )
            .for("update")
        )[0],
      );
      const before = receipt.before;
      await lockFamily(u, before.id, context);
      if (before.seriesId)
        await checkSeries(u, before.seriesId, receipt.seriesState, context);
      const current = assertRevision(
        (
          await tx
            .select()
            .from(timeBlocks)
            .where(blockOwner(u, before.id))
            .for("update")
        )[0],
        version,
      );
      const content = (block: typeof receipt.after) => ({
        ...block,
        version: 0,
        updatedAt: "",
      });
      if (
        !isDeepStrictEqual(content(snapshot(current)), content(receipt.after))
      )
        throw new AppError(
          409,
          "UNDO_CONFLICT",
          "The plan changed. This action cannot be undone safely.",
        );
      const restored = (
        await tx
          .update(timeBlocks)
          .set({
            title: before.title,
            categoryId: before.categoryId,
            goalId: before.goalId,
            notes: before.notes,
            startsAt: new Date(before.startsAt),
            endsAt: new Date(before.endsAt),
            isException: before.isException,
          })
          .where(and(blockOwner(u, before.id), eq(timeBlocks.version, version)))
          .returning()
      )[0]!;
      await tx
        .delete(editedTimeBlocks)
        .where(
          and(eq(editedTimeBlocks.userId, u), eq(editedTimeBlocks.id, undoId)),
        );
      const inverse = (
        await tx
          .insert(editedTimeBlocks)
          .values({
            userId: u,
            before: snapshot(current),
            after: snapshot(restored),
            seriesState: await getSeriesState(u, before.seriesId, context),
          })
          .returning()
      )[0]!;
      return { ...restored, undoId: inverse.id };
    },
    async deleteBlockWithUndo(
      u: string,
      id: string,
      version: number,
      sourceLinks: BlockSourceLink[],
      context?: TransactionContext,
      excludeOccurrence = true,
    ) {
      return transactionRunner(db)(async (scope) => {
        const tx = databaseFor(db, scope);
        await lockFamily(u, id, scope);
        const linked = await tx
          .select({ id: timeEntries.id })
          .from(timeEntries)
          .where(
            and(eq(timeEntries.userId, u), eq(timeEntries.timeBlockId, id)),
          )
          .for("update");
        const deleted = found(
          await this.deleteBlock(u, id, version, scope, excludeOccurrence),
        );
        const linkedEntries: Array<{ id: string; version: number }> = [];
        for (const entry of linked) {
          const current = found(await this.getEntry(u, entry.id, scope));
          linkedEntries.push({ id: current.id, version: current.version });
        }
        const receipt = (
          await tx
            .insert(deletedTimeBlocks)
            .values({
              userId: u,
              snapshot: snapshot(deleted),
              linkedEntries,
              sourceLinks,
              seriesState: await getSeriesState(u, deleted.seriesId, scope),
            })
            .returning()
        )[0]!;
        return { ok: true as const, undoId: receipt.id };
      }, context);
    },
    async getDeletion(u: string, id: string, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(deletedTimeBlocks)
          .where(
            and(eq(deletedTimeBlocks.userId, u), eq(deletedTimeBlocks.id, id)),
          )
      )[0];
    },
    async restoreBlock(
      u: string,
      undoId: string,
      context?: TransactionContext,
      seriesRestore = false,
    ) {
      return transactionRunner(db)(async (scope) => {
        const tx = databaseFor(db, scope);
        const receipt = found(
          (
            await tx
              .select()
              .from(deletedTimeBlocks)
              .where(
                and(
                  eq(deletedTimeBlocks.userId, u),
                  eq(deletedTimeBlocks.id, undoId),
                ),
              )
              .for("update")
          )[0],
        );
        const block = receipt.snapshot;
        if (block.seriesId && !seriesRestore) {
          const series = await checkSeries(
            u,
            block.seriesId,
            receipt.seriesState,
            scope,
          );
          if (!series.excludedDates.includes(block.occurrenceDate!))
            throw new AppError(
              409,
              "UNDO_CONFLICT",
              "This occurrence changed since deletion.",
            );
          await tx
            .update(calendarSeries)
            .set({
              excludedDates: sql`array_remove(${calendarSeries.excludedDates}, ${block.occurrenceDate}::date)`,
            })
            .where(
              and(
                eq(calendarSeries.userId, u),
                eq(calendarSeries.id, block.seriesId),
              ),
            );
        }
        const replacement = (
          await tx
            .select({ id: timeBlocks.id })
            .from(timeBlocks)
            .where(
              and(
                eq(timeBlocks.userId, u),
                or(
                  eq(timeBlocks.id, block.id),
                  ...(block.seriesId
                    ? [
                        and(
                          eq(timeBlocks.seriesId, block.seriesId),
                          eq(timeBlocks.occurrenceDate, block.occurrenceDate!),
                        ),
                      ]
                    : []),
                ),
              ),
            )
        )[0];
        if (replacement)
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "This plan already exists. The deletion cannot be undone safely.",
          );
        for (const linked of receipt.linkedEntries) {
          const entry = (
            await tx
              .select()
              .from(timeEntries)
              .where(entryOwner(u, linked.id))
              .for("update")
          )[0];
          if (
            !entry ||
            entry.version !== linked.version ||
            entry.timeBlockId !== null
          )
            throw new AppError(
              409,
              "UNDO_CONFLICT",
              "Recorded time changed since deletion. This block cannot be restored safely.",
            );
        }
        const restored = (
          await tx
            .insert(timeBlocks)
            .values({
              ...block,
              userId: u,
              version: block.version + 1,
              createdAt: new Date(block.createdAt),
              updatedAt: new Date(),
              startsAt: new Date(block.startsAt),
              endsAt: new Date(block.endsAt),
            })
            .returning()
        )[0]!;
        for (const linked of receipt.linkedEntries)
          await tx
            .update(timeEntries)
            .set({ timeBlockId: restored.id })
            .where(
              and(
                entryOwner(u, linked.id),
                eq(timeEntries.version, linked.version),
              ),
            );
        await tx
          .delete(deletedTimeBlocks)
          .where(
            and(
              eq(deletedTimeBlocks.userId, u),
              eq(deletedTimeBlocks.id, undoId),
            ),
          );
        return restored;
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
