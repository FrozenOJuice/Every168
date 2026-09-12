import { and, eq, lt, gt, asc, sql } from "drizzle-orm";
import type { Db, Database } from "../../infrastructure/database/client.js";
import type { BlockInput, TimeEntryInput } from "@168hours/contracts";
import { timeBlocks, timeEntries } from "./planning.table.js";
export function planningRepository(db: Database) {
  const blockOwner = (u: string, id: string) =>
    and(eq(timeBlocks.userId, u), eq(timeBlocks.id, id));
  const entryOwner = (u: string, id: string) =>
    and(eq(timeEntries.userId, u), eq(timeEntries.id, id));
  return {
    async getBlock(u: string, id: string, tx: Db = db) {
      return (await tx.select().from(timeBlocks).where(blockOwner(u, id)))[0];
    },
    async blocks(u: string, start: string, end: string) {
      return db
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
    },
    entries: (u: string, start: string, end: string) =>
      db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.userId, u),
            lt(timeEntries.startsAt, new Date(end)),
            gt(timeEntries.endsAt, new Date(start)),
          ),
        )
        .orderBy(asc(timeEntries.startsAt), asc(timeEntries.id)),
    async createBlock(u: string, input: BlockInput) {
      return (
        await db
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
    async updateBlock(u: string, id: string, input: BlockInput) {
      return (
        await db
          .update(timeBlocks)
          .set({
            ...input,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            updatedAt: new Date(),
          })
          .where(blockOwner(u, id))
          .returning()
      )[0];
    },
    async deleteBlock(u: string, id: string) {
      return db.transaction(async (tx) => {
        await tx
          .update(timeEntries)
          .set({ timeBlockId: null, updatedAt: new Date() })
          .where(
            and(eq(timeEntries.userId, u), eq(timeEntries.timeBlockId, id)),
          );
        return (
          await tx.delete(timeBlocks).where(blockOwner(u, id)).returning()
        )[0];
      });
    },
    async getEntry(u: string, id: string) {
      return (await db.select().from(timeEntries).where(entryOwner(u, id)))[0];
    },
    async createEntry(u: string, input: TimeEntryInput) {
      return (
        await db
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
    async updateEntry(u: string, id: string, input: TimeEntryInput) {
      return (
        await db
          .update(timeEntries)
          .set({
            ...input,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            updatedAt: new Date(),
          })
          .where(and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")))
          .returning()
      )[0];
    },
    async deleteEntry(u: string, id: string) {
      return (
        await db
          .delete(timeEntries)
          .where(and(entryOwner(u, id), eq(timeEntries.sourceType, "manual")))
          .returning()
      )[0];
    },
    async upsertSource(
      tx: Db,
      u: string,
      input: TimeEntryInput & {
        sourceType: "strength_workout" | "cardio_activity";
        sourceId: string;
      },
    ) {
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
      tx: Db,
      u: string,
      type: "strength_workout" | "cardio_activity",
      id: string,
    ) =>
      tx
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
