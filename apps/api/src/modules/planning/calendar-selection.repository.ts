import { and, eq } from "drizzle-orm";
import type { CalendarItem } from "@168hours/contracts";
import type { SeriesUndoState } from "./planning.types.js";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import {
  deletedCalendarGroups,
  editedCalendarGroups as edits,
} from "./calendar.table.js";

export function calendarSelectionRepository(db: Database) {
  const owned = (userId: string, id: string) =>
    and(
      eq(deletedCalendarGroups.userId, userId),
      eq(deletedCalendarGroups.id, id),
    );
  return {
    async createEdit(
      userId: string,
      values: Pick<
        typeof edits.$inferInsert,
        "blockEdits" | "beforeItems" | "afterItems" | "itemSeriesStates"
      >,
      context: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(edits)
          .values({ userId, ...values })
          .returning()
      )[0]!;
    },
    async getEdit(userId: string, id: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(edits)
          .where(and(eq(edits.userId, userId), eq(edits.id, id)))
          .for("update")
      )[0];
    },
    async removeEdit(userId: string, id: string, context: TransactionContext) {
      await databaseFor(db, context)
        .delete(edits)
        .where(and(eq(edits.userId, userId), eq(edits.id, id)));
    },
    async create(
      userId: string,
      blockUndoIds: string[],
      items: CalendarItem[],
      context: TransactionContext,
      itemSeriesStates: Record<string, SeriesUndoState> = {},
    ) {
      return (
        await databaseFor(db, context)
          .insert(deletedCalendarGroups)
          .values({ userId, blockUndoIds, items, itemSeriesStates })
          .returning()
      )[0]!;
    },
    async get(userId: string, id: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(deletedCalendarGroups)
          .where(owned(userId, id))
          .for("update")
      )[0];
    },
    async remove(userId: string, id: string, context: TransactionContext) {
      await databaseFor(db, context)
        .delete(deletedCalendarGroups)
        .where(owned(userId, id));
    },
  };
}
